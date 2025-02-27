const express = require("express");
const router = express.Router();
const User = require("./models/user.js"); // Import User model

// Get user from DB or fetch from ClickFunnels if not found
router.get("/get", async (req, res) => {
  try {
    const { accessToken } = req.query; // Get access token from frontend

    if (!accessToken) {
      return res.status(400).json({ error: "Access token is required" });
    }

    // Find user in DB using access token
    let user = await User.findOne({ access_token: accessToken });

    if (!user) {
      return res.status(404).json({ data: "not found" });
    }

    return res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
