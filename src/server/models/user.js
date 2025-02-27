const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    access_token: {
      type: String,
      required: true,
    },

    expires_in: {
      type: Number,
    },

    leadsPerWeek: {
      type: Number,
    },
    permissions: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

const User = mongoose.models.user || mongoose.model("user", UserSchema);
module.exports = User;
