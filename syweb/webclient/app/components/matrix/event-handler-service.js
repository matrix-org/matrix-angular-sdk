/*
Copyright 2014 OpenMarket Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

'use strict';

/*
This service handles what should happen when you get an event. This service does
not care where the event came from, it only needs enough context to be able to 
process them. Events may be coming from the event stream, the REST API (via 
direct GETs or via a pagination stream API), etc.

Typically, this service will store events and broadcast them to any listeners
(e.g. controllers) via $broadcast. 
*/
angular.module('eventHandlerService', [])
.factory('eventHandlerService', ['matrixService', '$rootScope', '$q', '$timeout', '$filter', 'mPresence', 'notificationService', 'modelService',
function(matrixService, $rootScope, $q, $timeout, $filter, mPresence, notificationService, modelService) {
    var ROOM_CREATE_EVENT = "ROOM_CREATE_EVENT";
    var MSG_EVENT = "MSG_EVENT";
    var MEMBER_EVENT = "MEMBER_EVENT";
    var PRESENCE_EVENT = "PRESENCE_EVENT";
    var POWERLEVEL_EVENT = "POWERLEVEL_EVENT";
    var CALL_EVENT = "CALL_EVENT";
    var NAME_EVENT = "NAME_EVENT";
    var TOPIC_EVENT = "TOPIC_EVENT";
    var RESET_EVENT = "RESET_EVENT";    // eventHandlerService has been resetted

    // used for dedupping events 
    var eventReapMap = {
    //  room_id: { event_id: time_seen }
    };
    var EVENT_ID_LIFETIME_MS = 1000 * 10; // lifetime of an event ID in the map is 10s
    var REAP_POLL_MS = 1000 * 11; // check for eligible event IDs to reap every 11s

    var initialSyncDeferred;
    
    // used for mapping mimetypes to thumbnails (if thumbnail is missing)
    var mimeTypeToIcon = {
        'audio'   : 'img/icons/filetype-audio.png',
        'image'   : 'img/icons/filetype-image.png',
        'message' : 'img/icons/filetype-message.png',
        'text'    : 'img/icons/filetype-text.png',
        'video'   : 'img/icons/filetype-video.png',
        ''        : 'img/icons/filetype-attachment.png', // the default. yes, keys can be an empty string
    };

    var reset = function() {
        initialSyncDeferred = $q.defer();
        eventReapMap = {};
    };
    reset();
    
    // reaps event IDs in eventReapMap. NOTE: This is NOT deleting the event,
    // this is just removing the event_id from an internal dict!
    var reapOldEventIds = function() {
        var now = new Date().getTime();
        for (var roomId in eventReapMap) {
            if (!eventReapMap.hasOwnProperty(roomId)) continue;
            var roomEvents = eventReapMap[roomId];
            for (var eventId in roomEvents) {
                if (!roomEvents.hasOwnProperty(eventId)) continue;
                if ( (now - roomEvents[eventId]) > EVENT_ID_LIFETIME_MS) {
                    delete roomEvents[eventId];
                }
            }
        }
        
        $timeout(reapOldEventIds, REAP_POLL_MS);
    };
    reapOldEventIds();
    
    // Generic method to handle events data
    var handleRoomStateEvent = function(event, isLiveEvent, addToRoomMessages) {
        var room = modelService.getRoom(event.room_id);
        if (addToRoomMessages) {
            // some state events are displayed as messages, so add them.
            room.addMessageEvent(event, !isLiveEvent);
        }
        
        if (isLiveEvent) {
            // update the current room state with the latest state
            room.current_room_state.storeStateEvent(event);
        }
        else {
            var eventTs = event.origin_server_ts;
            var storedEvent = room.current_room_state.getStateEvent(event.type, event.state_key);
            if (storedEvent) {
                if (storedEvent.origin_server_ts < eventTs) {
                    // the incoming event is newer, use it.
                    room.current_room_state.storeStateEvent(event);
                }
            }
        }
        // TODO: handle old_room_state
    };
    
    var handleRoomCreate = function(event, isLiveEvent) {
        $rootScope.$broadcast(ROOM_CREATE_EVENT, event, isLiveEvent);
    };

    var handleRoomAliases = function(event, isLiveEvent) {
        modelService.createRoomIdToAliasMapping(event.room_id, event.content.aliases[0]);
    };
    
    var containsBingWord = function(event) {
        if (!event.content || !event.content.body) {
            return false;
        }
    
        return notificationService.containsBingWord(
            matrixService.config().user_id,
            matrixService.config().display_name,
            matrixService.config().bingWords,
            event.content.body
        );
    };
    
    var displayNotification = function(event) {
        if (window.Notification && event.user_id != matrixService.config().user_id) {
            var member = modelService.getMember(event.room_id, event.user_id);
            var displayname = $filter("mUserDisplayName")(event.user_id, event.room_id);
            var message;
            var shouldBing = false;
            
            if (event.type === "m.room.message") {
                shouldBing = containsBingWord(event);
                message = event.content.body;
                if (event.content.msgtype === "m.emote") {
                    message = "* " + displayname + " " + message;
                }
                else if (event.content.msgtype === "m.image") {
                    message = displayname + " sent an image.";
                }
            }
            else if (event.type == "m.room.member") {
                // Notify when another user joins only
                if (event.state_key !== matrixService.config().user_id  && "join" === event.content.membership) {
                    member = modelService.getMember(event.room_id, event.state_key);
                    displayname = $filter("mUserDisplayName")(event.state_key, event.room_id);
                    message = displayname + " joined";
                    shouldBing = true;
                }
                else {
                    return;
                }
            }

            // Ideally we would notify only when the window is hidden (i.e. document.hidden = true).
            //
            // However, Chrome on Linux and OSX currently returns document.hidden = false unless the window is
            // explicitly showing a different tab.  So we need another metric to determine hiddenness - we
            // simply use idle time.  If the user has been idle enough that their presence goes to idle, then
            // we also display notifs when things happen.
            //
            // This is far far better than notifying whenever anything happens anyway, otherwise you get spammed
            // to death with notifications when the window is in the foreground, which is horrible UX (especially
            // if you have not defined any bingers and so get notified for everything).
            var isIdle = (document.hidden || matrixService.presence.unavailable === mPresence.getState());
            
            // We need a way to let people get notifications for everything, if they so desire.  The way to do this
            // is to specify zero bingwords.
            var bingWords = matrixService.config().bingWords;
            if (bingWords === undefined || bingWords.length === 0) {
                shouldBing = true;
            }
            
            if (shouldBing && isIdle) {
                console.log("Displaying notification for "+JSON.stringify(event));

                var roomTitle = $filter("mRoomName")(event.room_id);
                
                notificationService.showNotification(
                    displayname + " (" + roomTitle + ")",
                    message,
                    member ? member.event.content.avatar_url : undefined,
                    function() {
                        console.log("notification.onclick() room=" + event.room_id);
                        $rootScope.goToPage('room/' + event.room_id); 
                    }
                );
            }
        }
    };

    var handleMessage = function(event, isLiveEvent) {
        // Check for empty event content
        var hasContent = false;
        for (var prop in event.content) {
            hasContent = true;
            break;
        }
        if (!hasContent) {
            // empty json object is a redacted event, so ignore.
            return;
        }

        // fix up icons for files. XXX: is this the right place to do this?
        if (event.content.url && !event.content.thumbnail_url && event.content.info && event.content.info.mimetype) {
            var major = event.content.info.mimetype.substr(event.content.info.mimetype.indexOf("/"));
            event.content.thumbnail_url = mimeTypeToIcon[major] || mimeTypeToIcon[''];
            event.content.thumbnail_info = {
                w: 33,
                h: 40
            };
        }
        
        // =======================
        
        var room = modelService.getRoom(event.room_id);
        
        if (event.user_id !== matrixService.config().user_id) {
            room.addMessageEvent(event, !isLiveEvent);
            if (isLiveEvent) {
                displayNotification(event);
            }
        }
        else {
            // we may have locally echoed this, so we should replace the event
            // instead of just adding.
            room.addOrReplaceMessageEvent(event, !isLiveEvent);
        }
        
        // TODO send delivery receipt if isLiveEvent
        
        $rootScope.$broadcast(MSG_EVENT, event, isLiveEvent);
    };
    
    var handleRoomMember = function(event, isLiveEvent) {
        var room = modelService.getRoom(event.room_id);
        
        var memberChanges = undefined;

        // could be a membership change, display name change, etc.
        // Find out which one.
        if ((event.prev_content === undefined && event.content.membership) || (event.prev_content && (event.prev_content.membership !== event.content.membership))) {
            memberChanges = "membership";
        }
        else if (event.prev_content && (event.prev_content.displayname !== event.content.displayname)) {
            memberChanges = "displayname";
        }
        // mark the key which changed
        event.changedKey = memberChanges;
        
        
        // modify state before adding the message so it points to the right thing.
        // The events are copied to avoid referencing the same event when adding
        // the message (circular json structures)
        if (isLiveEvent) {
            var newEvent = angular.copy(event);
            newEvent.cnt = event.content;
            room.current_room_state.storeStateEvent(newEvent);
        }
        else {
            // mutate the old room state
            var oldEvent = angular.copy(event);
            oldEvent.cnt = event.content;
            if (event.prev_content) {
                // the m.room.member event we are handling is the NEW event. When
                // we keep going back in time, we want the PREVIOUS value for displaying
                // names/etc, hence the clobber here.
                oldEvent.cnt = event.prev_content;
            }
            
            if (event.changedKey === "membership" && event.content.membership === "join") {
                // join has a prev_content but it doesn't contain all the info unlike the join, so use that.
                oldEvent.cnt = event.content;
            }
            
            room.old_room_state.storeStateEvent(oldEvent);
        }
        
        // If there was a change we want to display, dump it in the message
        // list. This has to be done after room state is updated.
        if (memberChanges) {
            room.addMessageEvent(event, !isLiveEvent);
            
            if (memberChanges === "membership" && isLiveEvent) {
                displayNotification(event);
            }
        }
        
        $rootScope.$broadcast(MEMBER_EVENT, event, isLiveEvent);
    };
    
    var handlePresence = function(event, isLiveEvent) {
        // presence is always current, so clobber.
        modelService.setUser(event);
        $rootScope.$broadcast(PRESENCE_EVENT, event, isLiveEvent);
    };
    
    var handlePowerLevels = function(event, isLiveEvent) {
        handleRoomStateEvent(event, isLiveEvent);
        $rootScope.$broadcast(POWERLEVEL_EVENT, event, isLiveEvent);   
    };

    var handleRoomName = function(event, isLiveEvent) {
        console.log("handleRoomName room_id: " + event.room_id + " - isLiveEvent: " + isLiveEvent + " - name: " + event.content.name);
        handleRoomStateEvent(event, isLiveEvent, true);
        $rootScope.$broadcast(NAME_EVENT, event, isLiveEvent);
    };
    

    var handleRoomTopic = function(event, isLiveEvent) {
        console.log("handleRoomTopic room_id: " + event.room_id + " - isLiveEvent: " + isLiveEvent + " - topic: " + event.content.topic);
        handleRoomStateEvent(event, isLiveEvent, true);
        $rootScope.$broadcast(TOPIC_EVENT, event, isLiveEvent);
    };

    var handleCallEvent = function(event, isLiveEvent) {
        $rootScope.$broadcast(CALL_EVENT, event, isLiveEvent);
        if (event.type === 'm.call.invite') {
            var room = modelService.getRoom(event.room_id);
            room.addMessageEvent(event, !isLiveEvent);
        }
    };

    var handleRedaction = function(event, isLiveEvent) {
        if (!isLiveEvent) {
            // we have nothing to remove, so just ignore it.
            console.log("Received redacted event: "+JSON.stringify(event));
            return;
        }

        // we need to remove something possibly: do we know the redacted
        // event ID?
        var room = modelService.getRoom(event.room_id);
        // remove event from list of messages in this room.
        var eventList = room.events;
        for (var i=0; i<eventList.length; i++) {
            if (eventList[i].event_id === event.redacts) {
                console.log("Removing event " + event.redacts);
                eventList.splice(i, 1);
                break;
            }
        }
        
    };
    
    // resolves a room ID or alias, returning a deferred.
    var resolveRoomIdentifier = function(roomIdOrAlias) {
        var defer = $q.defer();
        if ('#' === roomIdOrAlias[0]) {
            matrixService.resolveRoomAlias(roomIdOrAlias).then(function(response) {
                defer.resolve(response.data.room_id);
                console.log("resolveRoomIdentifier: "+roomIdOrAlias+" -> " + response.data.room_id);
            },
            function(err) {
                console.error("resolveRoomIdentifier: lookup failed. "+JSON.stringify(err.data));
                defer.reject(err);
            });
        }
        else if ('!' === roomIdOrAlias[0]) {
            defer.resolve(roomIdOrAlias);
        }
        else {
            console.error("resolveRoomIdentifier: Unknown roomIdOrAlias => "+roomIdOrAlias);
            defer.reject("Bad room identifier: "+roomIdOrAlias);
        }
        return defer.promise;
    };

    return {
        ROOM_CREATE_EVENT: ROOM_CREATE_EVENT,
        MSG_EVENT: MSG_EVENT,
        MEMBER_EVENT: MEMBER_EVENT,
        PRESENCE_EVENT: PRESENCE_EVENT,
        POWERLEVEL_EVENT: POWERLEVEL_EVENT,
        CALL_EVENT: CALL_EVENT,
        NAME_EVENT: NAME_EVENT,
        TOPIC_EVENT: TOPIC_EVENT,
        RESET_EVENT: RESET_EVENT,
        EVENT_ID_LIFETIME_MS: EVENT_ID_LIFETIME_MS,
        
        reset: function() {
            reset();
            $rootScope.$broadcast(RESET_EVENT);
        },
    
        handleEvent: function(event, isLiveEvent) {
            // Suppress duplicate events: can be from races between /events and
            // room initial sync.
            if (event.event_id && eventReapMap[event.room_id] && eventReapMap[event.room_id][event.event_id]) {
                console.log("discarding duplicate event: " + JSON.stringify(event, undefined, 4));
                return;
            }
            else {
                if (!eventReapMap[event.room_id]) {
                    eventReapMap[event.room_id] = {};
                }
                eventReapMap[event.room_id][event.event_id] = new Date().getTime();
            }
            

            if (event.type.indexOf('m.call.') === 0) {
                handleCallEvent(event, isLiveEvent);
            }
            else {            
                switch(event.type) {
                    case "m.room.create":
                        handleRoomCreate(event, isLiveEvent);
                        break;
                    case "m.room.aliases":
                        handleRoomAliases(event, isLiveEvent);
                        break;
                    case "m.room.message":
                        handleMessage(event, isLiveEvent);
                        break;
                    case "m.room.member":
                        handleRoomMember(event, isLiveEvent);
                        break;
                    case "m.presence":
                        handlePresence(event, isLiveEvent);
                        break;
                    case 'm.room.join_rules':
                    case 'm.room.power_levels':
                        handlePowerLevels(event, isLiveEvent);
                        break;
                    case 'm.room.name':
                        handleRoomName(event, isLiveEvent);
                        break;
                    case 'm.room.topic':
                        handleRoomTopic(event, isLiveEvent);
                        break;
                    case 'm.room.redaction':
                        handleRedaction(event, isLiveEvent);
                        break;
                    default:
                        // if it is a state event, then just add it in so it
                        // displays on the Room Info screen.
                        if (typeof(event.state_key) === "string") { // incls. 0-len strings
                            if (event.room_id) {
                                handleRoomStateEvent(event, isLiveEvent, false);
                            }
                        }
                        console.log("Unable to handle event type " + event.type);
                        // console.log(JSON.stringify(event, undefined, 4));
                        break;
                }
            }
        },
        
        // isLiveEvents determines whether notifications should be shown, whether
        // messages get appended to the start/end of lists, etc.
        handleEvents: function(events, isLiveEvents) {
            for (var i=0; i<events.length; i++) {
                this.handleEvent(events[i], isLiveEvents);
            }
        },

        // Handle messages from /initialSync or /messages
        handleRoomMessages: function(room_id, messages, isLiveEvents, dir) {
            var events = messages.chunk;

            // Handles messages according to their time order
            if (dir && 'b' === dir) {
                // paginateBackMessages requests messages to be in reverse chronological order
                for (var i=0; i<events.length; i++) {
                    this.handleEvent(events[i], isLiveEvents);
                }
                
                // Store how far back we've paginated
                var room = modelService.getRoom(room_id);
                room.old_room_state.pagination_token = messages.end;

            }
            else {
                // InitialSync returns messages in chronological order, so invert
                // it to get most recent > oldest
                for (var i=events.length - 1; i>=0; i--) {
                    this.handleEvent(events[i], isLiveEvents);
                }
                // Store where to start pagination
                var room = modelService.getRoom(room_id);
                room.old_room_state.pagination_token = messages.start;
            }
        },
        
        handleRoomInitialSync: function(newRoom, response) {
            console.log("handleRoomInitialSync: "+newRoom.room_id+
                " ("+response.state.length+" state events) "+
                (response.messages && response.messages.chunk ? response.messages.chunk.length : "No")+
                " events");
            newRoom.current_room_state.storeStateEvents(response.state);
            newRoom.old_room_state.storeStateEvents(response.state);

            // this should be done AFTER storing state events since these
            // messages may make the old_room_state diverge.
            if (response.messages) {
                this.handleRoomMessages(newRoom.room_id, response.messages, false);
                newRoom.current_room_state.pagination_token = response.messages.end;
                newRoom.old_room_state.pagination_token = response.messages.start;
            }
        },

        handleInitialSyncDone: function(response) {
            var rooms = response.data.rooms;
            console.log("processing "+rooms.length+" initialSync rooms.");
            for (var i = 0; i < rooms.length; ++i) {
                var room = rooms[i];
                
                // FIXME: This is ming: the HS should be sending down the m.room.member
                // event for the invite in .state but it isn't, so fudge it for now.
                if (room.inviter && room.membership === "invite") {
                    var me = matrixService.config().user_id;
                    var fakeEvent = {
                        event_id: "__FAKE__" + room.room_id,
                        user_id: room.inviter,
                        origin_server_ts: 0,
                        room_id: room.room_id,
                        state_key: me,
                        type: "m.room.member",
                        content: {
                            membership: "invite"
                        }
                    };
                    if (!room.state) {
                        room.state = [];
                    }
                    room.state.push(fakeEvent);
                    console.log("RECV /initialSync invite >> "+room.room_id);
                }
                
                var newRoom = modelService.getRoom(room.room_id);
                this.handleRoomInitialSync(newRoom, room);
            }
            var presence = response.data.presence;
            this.handleEvents(presence, false);

            initialSyncDeferred.resolve("");
        },
        
        // joins a room and handles the requests which need to be done e.g. getting room state
        joinRoom: function(roomIdOrAlias) {
            var defer = $q.defer();
            var eventHandlerService = this;
            
            // TODO standardise error responses rather than returning where they fail, which could
            // return an error object (with errcode) or a string.
            var errorFunc = function(error) {
                console.error("joinRoom: " + JSON.stringify(error));
                defer.reject(error);
            };
            
            resolveRoomIdentifier(roomIdOrAlias).then(function(roomId) {
                // check if you are joined already
                eventHandlerService.waitForInitialSyncCompletion().then(function() {
                    var members = modelService.getRoom(roomId).current_room_state.members;
                    var me = matrixService.config().user_id;
                    if (me in members) {
                        if ("join" === members[me].event.content.membership) {
                            console.log("joinRoom: Already joined room "+roomId);
                            defer.resolve(roomId);
                            return;
                        }
                    }
                    // join the room and get current room state
                    matrixService.join(roomIdOrAlias).then(function() {
                        matrixService.roomInitialSync(roomId, 0).then(function(response) {
                            var room = modelService.getRoom(roomId);
                            room.current_room_state.storeStateEvents(response.data.state);
                            room.old_room_state.storeStateEvents(response.data.state);
                            var presence = response.data.presence;
                            eventHandlerService.handleEvents(presence, false);
                            console.log("joinRoom: Joined room "+roomId);
                            defer.resolve(roomId);
                        }, errorFunc);
                    }, errorFunc);
                }, errorFunc);
            }, errorFunc);
            
            return defer.promise;
        },

        // Returns a promise that resolves when the initialSync request has been processed
        waitForInitialSyncCompletion: function() {
            return initialSyncDeferred.promise;
        },
        
        eventContainsBingWord: function(event) {
            return containsBingWord(event);
        },
        
        // remove the ability to detect duplicates by removing known event IDs for this room.
        // Used in the event reaper service which nukes entire rooms: it needs to know that
        // the initial sync it performs will not be incorrectly dupe suppressed.
        wipeDuplicateDetection: function(roomId) {
            if (roomId in eventReapMap) {
                delete eventReapMap[roomId];
                console.log("[]? (<_<)=(>_>) ?[] Removed duplicate suppression for " + roomId);
            }
        }
        
    };
}]);
