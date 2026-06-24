const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { GoogleGenAI, Type } = require("@google/genai"); // Loaded Type for data structures

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // Tells Express to serve your HTML/CSS/JS files

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// We define a strict blueprint schema. Gemini is legally forced to respond only in this format!
const complaintSchema = {
  type: Type.OBJECT,
  properties: {
    problem: { type: Type.STRING },
    category: { type: Type.STRING },
    city: { type: Type.STRING },
    area: { type: Type.STRING },
    pincode: { type: Type.STRING },
    department: { type: Type.STRING },
    authority: { type: Type.STRING },
    priority: { type: Type.STRING },
  },
  required: ["problem", "category", "city", "area", "pincode", "department", "authority", "priority"],
};

// ROUTE 1: ANALYZING THE TEXT
app.post("/analyze", async (req, res) => {
  console.log("Analyze route hit");
  try {
    const { complaint } = req.body;

    const prompt = `
      You are an AI government complaint assistant. 
      Analyze the user's complaint, categorize it correctly, determine the responsible public department/authority, and establish local tracking details.
      
      User complaint: ${complaint}
    `;

    // Connect to the Gemini 2.5 Flash model
 let response;

for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: complaintSchema,
      }
    });

    break;
  } catch (error) {
    if (error.status === 503 && attempt < 3) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      continue;
    }
    throw error;
  }
}

const result = JSON.parse(response.text);
res.json({ result });

} catch(error) {
  console.error("AI Analysis failed:", error);

  if (error.status === 503) {
    return res.status(503).json({
      error: "Gemini AI is currently busy. Please try again in a minute."
    });
  }

  res.status(500).json({
    error: error.message
  });
}
});

// ROUTE 2: WRITING THE OFFICIAL PRINTABLE LETTER
app.post("/generate-letter", async (req, res) => {
  try {
    const data = req.body;
    const prompt = `
      Create a formal, highly professional complaint letter to a public official based on these details:
      Problem: ${data.problem}
      Authority: ${data.authority}
      Department: ${data.department}
      Location: ${data.area}, ${data.city} (Pincode: ${data.pincode})
      
      Write the professional body, placeholders for citizen metadata, and clear, respectful requests for action. Return only the letter content.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });

    res.json({ letter: response.text });

  } catch(error) {
    console.error("Letter generation failed:", error);
    res.status(500).json({ error: "Letter failed to generate" });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
