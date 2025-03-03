require("dotenv").config();
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const path = require("path");
const leadsRouter = require("./leads");
const authRouter = require("./auth");
const userRouter = require("./user");
const axios = require("axios");
const connectDB = require("./db");

const app = express();
const port = process.env.PORT || 3000;
connectDB();

// OpenAI configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// System message for API parameter extraction
const API_PARAMETER_EXTRACTION_MESSAGE = {
  role: "system",
  content: `You are a lead search parameter extractor. Extract location parameters from user messages.

Output format (JSON):
{
    "parameters": {
        "state": "two letter state code or null",
        "city": "city name or null",
        "zip": "5-digit zip code or null",
        "street": "street address or null",
    },
    "shouldSearchLeads": boolean,
    "searchReason": "brief explanation"
}

Rules:
1. Convert location abbreviations (e.g., "LA" → "Los Angeles")
2. Set shouldSearchLeads true if user wants to find/see/get leads or properties
3. Include searchReason explaining the decision
4. Only include parameters that are clearly specified`,
};

// Function to extract API parameters using AI
const extractSearchParameters = async (message) => {
  console.log("\n=== Analyzing User Query ===");
  console.log("User message:", message);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        API_PARAMETER_EXTRACTION_MESSAGE,
        { role: "user", content: message },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content);
    console.log("Extracted parameters:", JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error("Error analyzing query:", error);
    throw new Error("Failed to analyze query");
  }
};

// Function to format leads for display
const formatLeadsForDisplay = (leads, location) => {
  console.log("\n=== Formatting Response ===");

  if (!leads || leads.length === 0) {
    return `No leads available in ${location.city || ""} ${
      location.state || ""
    }`.trim();
  }

  return leads
    .map((lead) => {
      const address = lead.address || {};
      const owner =
        lead.deedHistory && lead.deedHistory.length > 0
          ? lead.deedHistory[lead.deedHistory.length - 1].buyers.join(", ")
          : "Unknown";

      return `- **Address**: ${address.houseNumber || ""} ${
        address.street || ""
      }, ${address.city || ""}, ${address.state || ""} ${address.zip || ""}
      **Owner**: ${owner}
      **Mailing**: ${address.city || ""}, ${address.state || ""} ${
        address.zip || ""
      }`;
    })
    .join("\n");
};

// CORS and JSON middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "1mb" }));

// Mount leads router
app.use("/api/leads", leadsRouter);
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Set up streaming response
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const sendSSE = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // 1. Analyze user query and extract parameters
    const analysis = await extractSearchParameters(message);

    const requiredParams = ["state", "city", "zip", "street"];
    const missingParams = requiredParams.filter(
      (param) => !analysis.parameters[param]
    );

    // 2. If we should search for leads
    if (analysis.shouldSearchLeads && missingParams.length === 0) {
      try {
        console.log("=== Processing Chat Lead Search ===");
        console.log("Extracted parameters:", analysis.parameters);

        // 3. Fetch leads using extracted parameters
        const response = await axios.get(`http://localhost:${port}/api/leads`, {
          params: analysis.parameters,
        });

        if (!response.data?.leads) {
          throw new Error("Invalid response format from leads API");
        }

        // 4. Format and display leads
        const formattedResponse = formatLeadsForDisplay(
          response.data.leads,
          analysis.parameters
        );

        // Stream the response
        for (const chunk of formattedResponse.match(/.{1,50}/g) || []) {
          sendSSE({ content: chunk });
        }
      } catch (error) {
        console.error("Error processing lead search in chat:", {
          message: error.message,
          response: error.response?.data,
          stack: error.stack,
        });

        let errorMessage = "Error processing leads request.";

        if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.message.includes("Invalid response format")) {
          errorMessage =
            "The search returned an unexpected format. Please try again.";
        }

        sendSSE({ error: errorMessage });
      }
    } else {
      // If not a leads query, inform the user
      sendSSE({
        content:
          "I can help you find leads. Please ask about properties in a specific location.",
      });
    }

    // Send completion message
    sendSSE({ done: true });
    res.end();
  } catch (error) {
    console.error("Chat endpoint error:", {
      message: error.message,
      stack: error.stack,
    });
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    } else {
      sendSSE({ error: "An error occurred processing your request" });
      res.end();
    }
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, "../../build")));

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
