/**
 * Notification aggregation helper.
 *
 * Likes and comments on the same post are collapsed into a single
 * notification per recipient so the notification screen and the user's
 * device are not flooded when a popular post gets many interactions.
 *
 * A push notification is only sent for the FIRST interaction on a post
 * (when the aggregated notification goes from non-existent -> created).
 * Subsequent interactions just bump the counter and refresh the list.
 */

const Notification = require('../models/Notification');

const MAX_SENDERS = 5;

// Event types that should be aggregated per (recipient, relatedPost, type).
const AGGREGATION_TYPES = new Set(['like', 'comment']);

/**
 * Upsert an aggregated notification.
 * @returns {Promise<{notification: Object, isNew: boolean}>}
 */
async function upsertAggregatedNotification({
  recipient,
  sender,
  type,
  message,
  relatedPost,
}) {
  if (!AGGREGATION_TYPES.has(type)) {
    const notification = await Notification.create({
      recipient,
      sender,
      type,
      message,
      relatedPost,
    });
    return { notification, isNew: true };
  }

  const query = { recipient, relatedPost, type };
  const existing = await Notification.findOne(query);

  if (existing) {
    const notification = await Notification.findOneAndUpdate(
      query,
      {
        $inc: { count: 1 },
        $set: { isRead: false, sender, message, updatedAt: new Date() },
        $push: { senders: { $each: [sender], $slice: -MAX_SENDERS } },
      },
      { new: true }
    );
    return { notification, isNew: false };
  }

  const notification = await Notification.create({
    recipient,
    sender,
    type,
    message,
    relatedPost,
    count: 1,
    senders: [sender],
  });
  return { notification, isNew: true };
}

/**
 * Decrement an aggregated like/comment notification when the actor
 * undoes their interaction. Removes the notification entirely when the
 * count reaches zero.
 */
async function decrementAggregatedNotification({ recipient, sender, type, relatedPost }) {
  const query = { recipient, relatedPost, type };
  const existing = await Notification.findOne(query);
  if (!existing) return;

  if (existing.count > 1) {
    const senderId = sender && sender.toString ? sender.toString() : String(sender);
    const remainingSenders = (existing.senders || []).filter(
      id => id.toString() !== senderId
    );
    existing.count -= 1;
    existing.senders = remainingSenders.length > 0 ? remainingSenders : (existing.sender ? [existing.sender] : []);
    await existing.save();
  } else {
    await Notification.findOneAndDelete({ _id: existing._id });
  }
}

module.exports = {
  upsertAggregatedNotification,
  decrementAggregatedNotification,
  AGGREGATION_TYPES,
};
