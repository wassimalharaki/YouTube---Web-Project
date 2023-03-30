const mongoose = require('mongoose');
const videos = require('./videos');
const express = require('express');
const app = express();
const path = require('path');
const crypto = require('crypto');
const multer = require('multer'); //used in multipart/form-data forms, adds a files or file to the request
const GridFsStorage = require('multer-gridfs-storage').GridFsStorage; //used to create a file to upload
const Grid = require('gridfs-stream'); //stream data into and out of the database
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname,"styles")));
app.use(express.static(path.join(__dirname,"images")));
app.use(express.static(path.join(__dirname,"slick")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

const mongoURI = "mongodb://127.0.0.1:27017/YouTube";

mongoose.connect(mongoURI).then(console.log("Connected to Database"));

var conn = mongoose.connection;

let gfs, gridfsBucket;

conn.once('open', () => {
    gridfsBucket = new mongoose.mongo.GridFSBucket(conn.db, { //stores file names and file chunks
        bucketName: 'videoSchema'
    });

    gfs = Grid(conn.db, mongoose.mongo); //breaks file into chunks and stores it into bucket
    gfs.collection('videoSchema');
});

const storage = new GridFsStorage({ //file
    url: mongoURI,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err)
                    return reject(err);
                const filename = buf.toString('hex') + path.extname(file.originalname);
                const fileInfo = {
                    filename: filename,
                    bucketName: 'videoSchema'
                };
                resolve(fileInfo);
            });
        });
    }
});
const upload = multer({ storage }); //upload file using multer

app.get('/', async (req, res) => {
    const allVideos = (await videos.find({})).reverse();
    res.render('home', {videos: allVideos});
});

app.get('/uploadPage', (req, res) => {
    res.render('upload');
});

app.post('/upload', upload.fields([
    {name: 'video', maxCount: 1},
    {name: 'thumbnail', maxCount: 1}
]), async (req, res) => {
    console.log(req.files);
    const video = await videos.create({
        filename: req.files.video[0].filename,
        Title: req.body.title.trim(),
        VideoName: req.files.video[0].originalname,
        ThumbnailName: req.files.thumbnail[0].originalname
    });
    res.redirect('/');
});

app.get('/video/:filename', async (req, res) => {
    const filename = req.params.filename;
    gfs.files.findOne({filename: filename}, (err, file) => {
        if(!file || file.length === 0)
            return res.send("file doesn't exist");
        const readstream = gridfsBucket.openDownloadStream(file._id);
        readstream.pipe(res);
    });
});

var videoID;

app.get('/displayVideo/:videoID', async (req, res) => {
    videoID = req.params.videoID;
    const video = await videos.findOneAndUpdate({_id: videoID}, {$inc: {Views: 1}});
    res.redirect('/displayVideo');
});

app.get('/displayVideo', async (req, res) => {
    const video = await videos.findById(videoID);
    res.render('displayVideo', {
        video: video
    });
});

app.post('/delete/:videoID', async (req, res) => {
    videoID = req.params.videoID;
    const video = await videos.findByIdAndDelete(videoID);
    res.redirect('/');
});


app.listen(3000);