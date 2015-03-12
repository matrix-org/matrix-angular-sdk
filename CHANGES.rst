Changes in Matrix Angular SDK 0.6.5 (2015-03-12)
================================================
Features:
 - Push notifications can now be setup in the Settings page.
 - Text entered into the input box for a room will be preserved across
   room swaps.

Bug fixes:
 - Fixed a bug where auto-scroll for images did not work correctly.
 - Fixed a bug which resulted in a partially populated room when another
   device joined a room.
 - Fixed a bug which prevented files with the same name being uploaded
   sequentially.
 - Correctly remove redacted event text from the recent activity list.
 - Firefox: Can now join rooms which have a double ## alias.

Improvements:
 - Modified Settings page layout.
 - Angular SDK now relies on the Javascript SDK for new API features.
 - Transparent images will now be shown on a white background.
 - GIFs are now marked as such on the thumbnail for the image.
 - The web client version is now shown in Settings.

Changes in Matrix Angular SDK 0.6.4 (2015-02-27)
================================================
Features:
 - Add support for sending messages in Markdown by typing "/markdown some text"

Bug fixes:
 - Fixed a bug which caused the settings page to fail to load correctly if
   config.js did not exist.
 - Fixed a bug which failed to redirect the user to the login page if they
   directly typed a room into the address bar.

Improvements:
 - Update to Angular 1.3.13
 - Update to jQuery 2.1.3
 - Improve page load performance
 - Slightly randomise reconnection times to address thundering herd problems.

Changes in Matrix Angular SDK 0.6.3 (2015-02-18)
================================================
Features:
 - Add support for sending/receiving SMS via the OpenMarket Matrix Gateway.

Changes in Matrix Angular SDK 0.6.2 (2015-02-12)
================================================
Bug fixes:
 - Fixed a bug which caused OpenWebRTC to occasionally fail.
 - Fixed a bug which caused multiple room initial syncs to occur in rapid
   succession.

Features:
 - Display a "Joining Room" dialog when joining rooms.
 - Display identicons for users with no avatar.
 - Display m.notice events with full formatting.
 - Add push notification rules to settings.

Improvements:
 - Modified the red/blue notification colours to be more noticeable on a wider
   range of displays.
 - Highlight room invitations in blue.
 - Calculate room names for rooms of 3+ members.
 - Improved page load performance.

Changes in Matrix Angular SDK 0.6.1 (2015-01-08)
================================================
Bug fixes:
 - Fixed a bug with mobile CSS.
 - Adjusted mxc:// thumbnail parameters to resize images correctly.
 - Fixed spurious width errors in the console.
 - Fixed a bug which expected /initialSync to have a 'rooms' key.
 - Prevent sent messages from highlighting rooms.
 - Fixed a bug which caused some message bodies with < and > to be incorrectly
   sanitized which stripped the entire contents of the message.


Changes in Matrix Angular SDK 0.6.0 (2014-12-19)
================================================

Breaking changes:
 - Uploading files in the web client will now hit the new content repository URL
   introduced in Synapse 0.6.

Bug fixes:
 - Fixed a bug which caused the event stream to become wedged when the computer is asleep.
 - Fixed a bug which caused the recents to update but not the message window.

Features:
 - Typing notifications will now be sent.
 - Typing notifications will now be displayed for other users.
 - Use the new content repository introduced in Synapse 0.6 when uploading files.

Improvements:
 - Display more error dialogs rather than silently failing.
 - Display loading spinners on signup.
 - Display feedback when joining a room.
 - CTRL + clicking on a recents entry will now open that room in a new tab.
 - Clicking on links in messages will now open them in a new tab.
 - Provide a progress dialog when uploading files.
 - Display a red bar when the event stream connection is lost for an extended period of time.

Changes in Matrix Angular SDK 0.5.3 (2014-12-05)
================================================

Bug fixes:
 - Fixed a bug where the display name was not always displaying on emotes.
 - Fixed a bug which caused avatar pictures on calls to not load at all.
 - Rooms will now paginate until a scrollbar appears, ensuring pagination can happen.

Features:
 - Screen reader support (courtesy of ndarilek, pull request #2)

Improvements:
 - Display an error dialog if a call fails due to rejecting permission to the mic.
 - Modify button colours.
 - Decreased the size of the global initial sync, and lazy load more messages when a room opens.
 - Display desktop notifications for incoming room invitations.
 - Auto-focus the close button on dialogs.

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
