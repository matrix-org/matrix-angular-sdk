Changes in Matrix Angular SDK 0.5.2 (2014-12-01)
================================================

Bug fixes:
 - Fixed a bug which caused Firefox to not relinquish the mic after a call.
 - Fixed a bug which caused the initial sync to not work in bad network conditions.
 - Fixed a bug which caused duplicate/missing messages when quickly leaving/joining the same room.
 - Refresh TURN server URLs when logging out and back in again.
 - Fixed a bug which could cause avatars to not display on the user list for a room.
 - Fixed a bug which caused some users to not show their power level.
 - No longer show left/banned/kicked members in the user list.

Features:
 - Added option for audio notifications.
 - Added ability to resend unsent messages by double-clicking on them.

Improvements:
 - Improved digest performance.

Changes in Matrix Angular SDK 0.5.1 (2014-11-26)
================================================

Bug fixes:
 - Dismiss the Room Info dialog when leaving a room.
 - Fixed the display of usernames for emotes/room actions.
 - Scroll the message window for all kinds of events, not just messages.
 - Fixed a bug when leaving a room via the X in recents.
 - Fixed a bug with a local echo message not being replaced by the real message.
 - Fixed a bug which could cause old events to be streamed as if they were live.

Features:
 - Update the title of the window with the number of unread messages.
 - Added spinners whilst loading the public room list and recent conversations.
 - Shift-clicking a user's name on a message will insert their name into the input box.

Improvements:
 - Show desktop notifications for incoming VoIP calls.
 - Change the UX for creating new rooms.
 - Make IRC-style /commands case-insensitive.
 - Retry rate limited requests.
 - Display file icons for incoming files.
 - Improved the handling of multiple desktop notifications.
 - Various performance improvements (memory leaks, speed).
 - Various CSS layout improvements.
