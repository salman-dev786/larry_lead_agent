const express = require("express");
const router = express.Router();
const axios = require("axios");
const qs = require("qs");
const User = require("./models/user");
// ClickFunnels OAuth Configuration
const CLIENT_ID = process.env.CLICKFUNNELS_CLIENT_ID;
const CLIENT_SECRET = process.env.CLICKFUNNELS_CLIENT_SECRET;
const REDIRECT_URI = process.env.CLICKFUNNELS_REDIRECT_URI;
const TOKEN_URL = "https://accounts.myclickfunnels.com/oauth/token";
const Website_URI = process.env.Website_URI;

// OAuth Authentication Route
router.get("/clickfunnels", (req, res) => {
  const authUrl = `https://accounts.myclickfunnels.com/oauth/authorize?client_id=${CLIENT_ID}&grant_type=authorization_code&redirect_uri=${REDIRECT_URI}&response_type=code&new_installation=true`;
  return res.redirect(authUrl);
});

// OAuth Callback Route
router.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res
      .status(400)
      .json({ success: false, error: "Authorization code missing" });
  }

  try {
    const response = await axios.post(
      TOKEN_URL,
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code,
        grant_type: "authorization_code",
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data = response?.data;

    let user = await User.findOne({ email: data?.email });

    if (!user) {
      // Create and save new user
      user = new User({
        name: data?.team_name,
        access_token: data?.access_token,
        expires_in: data?.expires_in,
        permissions: [], // Default empty array
      });

      await user.save();
    } else {
      // Update existing user's access token
      user.access_token = data?.access_token;
      user.expires_in = data?.expires_in;
      await user.save();
    }

    if (data?.access_token) {
      // Redirect back to frontend with token in URL
      return res.redirect(`${Website_URI}?token=${data.access_token}`);
    } else {
      return res.status(400).json({ error: "Token exchange failed" });
    }
  } catch (error) {
    console.error("OAuth Error:", error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
