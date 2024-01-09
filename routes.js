const express= require("express");
const Router = express.Router();
const multer = require("multer");
const mongoose=require('mongoose');

require("./models/imagedetails");
const Imageschema=mongoose.model("Image_model");

const upload = multer({ storage: multer.memoryStorage() });



Router.route("/add-image").post(upload.single('img'),async (req,res)=>{
  try {
    const ImageBuffer=req.file.buffer;
    // console.log(ImageBuffer);

    await Imageschema.create({ image: ImageBuffer });

    res.status(200).send('Image uploaded successfully');
  } catch (error) {
    res.status(500).send('Error uploading image: ' + error.message);
  }

});

module.exports = Router;