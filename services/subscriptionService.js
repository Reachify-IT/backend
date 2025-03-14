const User = require("../models/User");

const PLAN_LIMITS = {
  Starter: 2000,
  Pro: 5000,
  Enterprise: 10000
};

// 🛠️ Check if user can upload more videos
exports.canUploadVideos = async (userId, videoCount) => {
  const user = await User.findById(userId);
  if (!user) return { allowed: false, message: "User not found" };

  const maxLimit = PLAN_LIMITS[user.planDetails] || 0;
  const usedCount = user.videosCount || 0;
  const newTotal = usedCount + videoCount;

  if (newTotal > maxLimit) {
    return { 
      allowed: false, 
      message: `Storage limit exceeded! You can store up to ${maxLimit} videos.` 
    };
  }

  return { allowed: true, remaining: maxLimit - usedCount };
};

// 🛠️ Update user's stored video count
exports.incrementVideoCount = async (userId, count) => {
  await User.findByIdAndUpdate(userId, { $inc: { videosCount: count } });
};

// 🛠️ Reduce count when videos are deleted
exports.decrementVideoCount = async (userId, count) => {
  await User.findByIdAndUpdate(userId, { $inc: { videosCount: -count } });
};

// 🛠️ Upgrade User Plan and Save Payment History
exports.upgradePlan = async (userId, newPlan, paymentDetails) => {
  const user = await User.findById(userId);
  if (!user) return { success: false, message: "User not found" };

  if (!PLAN_LIMITS[newPlan]) {
    return { success: false, message: "Invalid plan selected" };
  }

  if (PLAN_LIMITS[newPlan] <= PLAN_LIMITS[user.planDetails]) {
    return { success: false, message: "You are already on this plan or higher" };
  }

  // ✅ Upgrade Plan
  user.planDetails = newPlan;
  
  // ✅ Reset Video Count on Upgrade
  user.videosCount = 0;

  // ✅ Store Payment Details in User's Payment History
  user.paymentHistory.push({
    orderId: paymentDetails.orderId,
    amount: paymentDetails.amount,
    status: paymentDetails.status,
    date: new Date()
  });

  await user.save();

  return { success: true, message: `Plan upgraded to ${newPlan}` };
};
