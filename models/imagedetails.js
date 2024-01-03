const mongoose=require('mongoose')

const Imageschema=new mongoose.Schema(
  {
    image:Buffer
  },
  {
    collection:"Image_model",
  }
);
mongoose.model("Image_model",Imageschema);