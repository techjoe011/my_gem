require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const app = express();
const PORT = process.env.PORT || 6000;
const https = require("https");

const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");
const bodyParser = require("body-parser");
const APIkey = process.env.Geminiapikey;
app.use(express.json());

app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

mongoose
  .connect(process.env.Mongo_URI)
  .then((res) => console.log("Connected to DB"))
  .catch((e) => console.log(e));

require("./models/imagedetails");
const Imageschema = mongoose.model("Image_model");

const routes = require("./routes");
app.use("/routes", routes);

// IMAGE INPUT and TEXT INPUT-----------------------------------------------------------------

async function functionToGetLastImage() {
  try {
    const lastImage = await Imageschema.findOne().sort({ _id: -1 });
    if (lastImage && lastImage.image) {
      return lastImage.image.toString("base64");
    } else {
      throw new Error("No image found");
    }
  } catch (error) {
    throw new Error("Error fetching last image: " + error.message);
  }
}

app.post("/generateText", async (req, res) => {
  try {
    const { textInput } = req.body;

    if (!textInput) {
      return res.status(400).json({ error: "Text input is required." });
    }

    const imageBase64 = await functionToGetLastImage();
    console.log("photo base64");

    const requestData = JSON.stringify({
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: imageBase64,
              },
            },
            {
              text: textInput,
            },
          ],
        },
      ],
    });

    const options = {
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/gemini-pro-vision:generateContent?key=${APIkey}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    };

    const reqToGoogleAPI = https.request(options, (resFromGoogleAPI) => {
      let responseData = "";

      resFromGoogleAPI.on("data", (chunk) => {
        responseData += chunk;
      });

      resFromGoogleAPI.on("end", () => {
        try {
          const responseObj = JSON.parse(responseData);
          if (
            responseObj &&
            responseObj.candidates &&
            responseObj.candidates.length > 0 &&
            responseObj.candidates[0].content &&
            responseObj.candidates[0].content.parts &&
            responseObj.candidates[0].content.parts.length > 0
          ) {
            const generatedText =
              responseObj.candidates[0].content.parts[0].text;
            console.log("Generated Text:", generatedText);
            res.status(200).json({ generatedText }); // Send the generated text back to the client
          } else {
            console.error("No valid response data found");
            res.status(500).json({ error: "No valid response data found" });
          }
        } catch (error) {
          console.error("Error parsing response:", error.message);
          res.status(500).json({ error: "Error parsing response" });
        }
      });
    });

    reqToGoogleAPI.on("error", (error) => {
      console.error("Error:", error.message);
      res.status(500).json({ error: "Error connecting to Google API" });
    });

    reqToGoogleAPI.write(requestData);
    reqToGoogleAPI.end();
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({
      error: "An error occurred while generating text from the image.",
    });
  }
});

//Final MultiTurn chatting - TEXT only Input model------------------------------------------------------

const genAI = new GoogleGenerativeAI(APIkey);

let chatHistory = [];

app.post("/generatethetext", async (req, res) => {
  try {
    let { history, userInput } = req.body;
    console.log("User input: ", userInput);

    if (!Array.isArray(history)) {
      history = []; // Initialize history if not provided or not an array
    }

    // Set the global chat history to the received history
    chatHistory = history;

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // Start chat with the updated chat history
    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        temperature: 0.7,
        topK: 50,
        topP: 0.9,
        maxOutputTokens: 2048,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });

    // Simulate multi-turn conversation
    const result = await chat.sendMessageStream(userInput);
    const response = await result.response;
    const text = response.text();
    console.log("model: ", text);

    // Update chat history
    chatHistory.push({ role: "user", parts: userInput });
    chatHistory.push({ role: "model", parts: text });

    res.json({ generatedText: text, updatedHistory: chatHistory });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: "An error occurred while generating text." });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);

  // Send a response when the server is running
  app.get("/", (req, res) => {
    res.write("I'm alive");
    res.end();
  });
});
