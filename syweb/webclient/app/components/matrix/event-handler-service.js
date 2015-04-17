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
.factory('eventHandlerService', ['matrixService', '$rootScope', '$window', '$q', '$timeout', '$filter', 'mPresence', 'notificationService', 'modelService', 'commandsService',
function(matrixService, $rootScope, $window, $q, $timeout, $filter, mPresence, notificationService, modelService, commandsService) {
    // used for dedupping events 
    var eventReapMap = {
    //  room_id: { event_id: time_seen }
    };
    var REAP_POLL_MS = 1000 * 11; // check for eligible event IDs to reap every 11s

    var initialSyncDeferred;
    var initialSyncComplete = false;
    
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
        initialSyncComplete = false;
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
                if ( (now - roomEvents[eventId]) > eventHandlerService.EVENT_ID_LIFETIME_MS) {
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
        $rootScope.$broadcast(eventHandlerService.STATE_EVENT, event, isLiveEvent);
        // TODO: handle old_room_state
    };
    
    var handleRoomCreate = function(event, isLiveEvent) {
        $rootScope.$broadcast(eventHandlerService.ROOM_CREATE_EVENT, event, isLiveEvent);
    };

    var handleRoomAliases = function(event, isLiveEvent) {
        modelService.createRoomIdToAliasMapping(event.room_id, event.content.aliases[0]);
        recalculateRoomName(event.room_id);
    };
    
    var recalculateRoomName = function(roomId) {
        modelService.getRoom(roomId).name = $filter("mRoomName")(roomId);
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
        if (event.content.url && !event.content.thumbnail_url && event.content.info && event.content.info.mimetype && event.content.url.indexOf("mxc://") != 0) {
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
                notificationService.processEvent(event);
            }
        }
        else {
            // we may have locally echoed this, so we should replace the event
            // instead of just adding.
            room.addOrReplaceMessageEvent(event, !isLiveEvent);
        }
        
        // TODO send delivery receipt if isLiveEvent
        
        $rootScope.$broadcast(eventHandlerService.MSG_EVENT, event, isLiveEvent);
    };
    
    var handleRoomMember = function(event, isLiveEvent) {
        var room = modelService.getRoom(event.room_id);
        var memberChanges = room.getChangedKeyForMemberEvent(event);
        var me = matrixService.config().user_id;

        if (event.state_key === me && event.content && event.content.membership === "join") {
            // incoming join event but we are not joined nor are we syncing this room (meaning
            // another one of our devices joined the room)
            if (!room.isJoinedRoom(me) && !room.syncing) {
                var roomId = event.room_id;
                console.log("handleRoomMember: Syncing room -> %s", roomId);
                matrixService.roomInitialSync(roomId, 0).then(function(response) {
                    eventHandlerService.handleRoomInitialSync(room, response.data);
                    var presence = response.data.presence;
                    eventHandlerService.handleEvents(presence, false);
                    console.log("handleRoomMember: synced room "+roomId);
                },
                function(err) {
                    console.error("handleRoomMember: Unable to sync room: %s", JSON.stringify(err));
                });
            }
        }
        
        // modify state before adding the message so it points to the right thing.
        // The events are copied to avoid referencing the same event when adding
        // the message (circular json structures)
        room.mutateRoomMemberState(angular.copy(event), isLiveEvent);
        
        // If there was a change we want to display, dump it in the message
        // list. This has to be done after room state is updated.
        if (memberChanges) {
            room.addMessageEvent(event, !isLiveEvent);
            
            if (memberChanges === "membership" && isLiveEvent) {
                recalculateRoomName(event.room_id);
                notificationService.processEvent(event);
            }
        }
        
        $rootScope.$broadcast(eventHandlerService.MEMBER_EVENT, event, isLiveEvent);
    };
    
    var handlePresence = function(event, isLiveEvent) {
        // presence is always current, so clobber.
        modelService.setUser(event);
        $rootScope.$broadcast(eventHandlerService.PRESENCE_EVENT, event, isLiveEvent);
    };
    
    var handlePowerLevels = function(event, isLiveEvent) {
        handleRoomStateEvent(event, isLiveEvent);
        $rootScope.$broadcast(eventHandlerService.POWERLEVEL_EVENT, event, isLiveEvent);   
    };

    var handleRoomName = function(event, isLiveEvent) {
        handleRoomStateEvent(event, isLiveEvent, true);
        recalculateRoomName(event.room_id);
        $rootScope.$broadcast(eventHandlerService.NAME_EVENT, event, isLiveEvent);
    };

    var handleRoomTopic = function(event, isLiveEvent) {
        handleRoomStateEvent(event, isLiveEvent, true);
        $rootScope.$broadcast(eventHandlerService.TOPIC_EVENT, event, isLiveEvent);
    };

    var handleCallEvent = function(event, isLiveEvent) {
        $rootScope.$broadcast(eventHandlerService.CALL_EVENT, event, isLiveEvent);
        // We add hangup events to the room too because generally all we get in
        // the initialsync is a hangup event and come candidate events. If don't
        // add either of those, the room ends up having no events and so we
        // don't know where to put it in the ordering.
        // Roll on CS API v2 event filtering and other call events being update events.
        if (event.type === 'm.call.invite' || event.type === 'm.call.hangup') {
            var room = modelService.getRoom(event.room_id);
            room.addMessageEvent(event, !isLiveEvent);
        }
    };

    var handleRedaction = function(event, isLiveEvent) {
        if (!isLiveEvent) {
            // we have nothing to remove, so just ignore it.
            return;
        }

        // we need to remove something possibly: do we know the redacted
        // event ID?
        var room = modelService.getRoom(event.room_id);
        // remove event from list of messages in this room.
        var annotatedEvents = room.aevents;
        for (var i=0; i<annotatedEvents.length; i++) {
            if (annotatedEvents[i].event.event_id === event.redacts) {
                console.log("Removing event " + event.redacts);
                annotatedEvents.splice(i, 1);
                break;
            }
        }
        if (annotatedEvents.length > 0) {
            room.lastAnnotatedEvent = annotatedEvents[annotatedEvents.length-1];
        }
        else {
            room.lastAnnotatedEvent = undefined;
        }
    };
    
    var handleTyping = function(event, isLiveEvent) {
        if (!isLiveEvent) {
            return; // m.typing is an EDU, so they should always be live.
        }
        
        var room = modelService.getRoom(event.room_id);
        
        // m.typing events clobber, so null out all the typing notifications.
        for (var userId in room.now.members) {
            if (!room.now.members.hasOwnProperty(userId)) continue;
            var member = room.now.members[userId];
            member.typing = false;
        }
        
        // set the users currently typing
        if (event.content && event.content.user_ids) {
            for (var i=0; i<event.content.user_ids.length; i++) {
                var userId = event.content.user_ids[i];
                var member = room.now.members[userId];
                if (member) {
                    member.typing = true;
                }
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

    var eventHandlerService = {
        ROOM_CREATE_EVENT: "ROOM_CREATE_EVENT",
        MSG_EVENT: "MSG_EVENT",
        MEMBER_EVENT: "MEMBER_EVENT",
        PRESENCE_EVENT: "PRESENCE_EVENT",
        POWERLEVEL_EVENT: "POWERLEVEL_EVENT",
        CALL_EVENT: "CALL_EVENT",
        NAME_EVENT: "NAME_EVENT",
        TOPIC_EVENT: "TOPIC_EVENT",
        RESET_EVENT: "RESET_EVENT",  // eventHandlerService has been reset
        STATE_EVENT: "STATE_EVENT",
        EVENT_ID_LIFETIME_MS: 1000 * 10, // lifetime of an event ID in the map is 10s
        
        reset: function() {
            reset();
            $rootScope.$broadcast(eventHandlerService.RESET_EVENT);
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
                    case "m.typing":
                        handleTyping(event, isLiveEvent);
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
            recalculateRoomName(newRoom.room_id);
        },

        handleInitialSyncDone: function(response) {
            var rooms = response.data.rooms;
            if (rooms) {
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
                        $rootScope.$broadcast(eventHandlerService.MEMBER_EVENT, fakeEvent, false);
                    }
                
                    var newRoom = modelService.getRoom(room.room_id);
                    this.handleRoomInitialSync(newRoom, room);
                }
                var presence = response.data.presence;
                this.handleEvents(presence, false);
            }
            initialSyncComplete = true;
            initialSyncDeferred.resolve("");
        },
        
        resendMessage: function(annotatedEvent, sendCallback) {
            modelService.getRoom(annotatedEvent.event.room_id).removeEvent(annotatedEvent.event);
            return this.sendMessage(
                annotatedEvent.event.room_id, 
                annotatedEvent._original_input, 
                sendCallback
            );
        },
        
        sendMessage: function(roomId, input, sendCallback) {
            // Store the command in the history
            $rootScope.$broadcast("commandHistory:BROADCAST_NEW_HISTORY_ITEM(item)",
                              input);

            var isEmote = input.indexOf("/me ") === 0;
            var isMarkdown = input.indexOf("/markdown ") === 0;
            var promise;
            if (!isEmote && !isMarkdown) {
                promise = commandsService.processInput(roomId, input);
            }
            
            if (input.indexOf("//") === 0) {
                input = input.substring(1);
            }
            
            var echo = false;
            var bodyPart = input;
            if (!promise) { // not a non-echoable command
                echo = true;
                if (isEmote) {
                    bodyPart = input.substring(4);
                    promise = matrixService.sendEmoteMessage(roomId, bodyPart);
                }
                else if (isMarkdown) {
                    bodyPart = input.substring("/markdown ".length);
                    var htmlBody = marked(bodyPart);
                    promise = matrixService.sendHtmlMessage(roomId, bodyPart, htmlBody);
                }
                else {
                    promise = matrixService.sendTextMessage(roomId, input);
                }
            }
            
            if (echo) {
                // Echo the message to the room
                // To do so, create a minimalist fake text message event and add it to the in-memory list of room messages
                var echoMessage = {
                    content: {
                        body: bodyPart,
                        msgtype: (isEmote ? "m.emote" : "m.text"),
                    },
                    origin_server_ts: new Date().getTime(), // fake a timestamp
                    room_id: roomId,
                    type: "m.room.message",
                    user_id: matrixService.config().user_id
                };
                var annotatedEvent = modelService.getRoom(roomId).addMessageEvent(echoMessage);
                annotatedEvent._original_input = input;
                annotatedEvent.send_state = "pending";
                annotatedEvent.css_class = "messagePending";
                sendCallback.onSendEcho(echoMessage);
            }

            if (promise) {
                promise.then(
                    function(response) {
                        sendCallback.onSent(response, echo);
                        if (echoMessage) {
                            var eventId = response.data.event_id;
                            var exists = modelService.getRoom(roomId).getAnnotatedEvent(eventId);
                            if (exists) {
                                // kill the echo message, we have the real one already
                                modelService.getRoom(roomId).removeEvent(echoMessage);
                            }
                            else {
                                // Mark this fake message event with its allocated event_id
                                // When the true message event will come from the events stream (in handleMessage),
                                // we will be able to replace the fake one by the true one
                                echoMessage.event_id = response.data.event_id;
                            }
                        }
                    },
                    function(error) {
                        sendCallback.onError(error);
                        if (annotatedEvent) {
                            // Mark the message as unsent for the rest of the page life
                            annotatedEvent.origin_server_ts = "Unsent";
                            annotatedEvent.send_state = "unsent";
                            annotatedEvent.css_class = "messageUnSent";
                        }
                    }
                );
            }
        },
        
        // joins a room and handles the requests which need to be done e.g. getting room state
        joinRoom: function(roomIdOrAlias) {
            var defer = $q.defer();
            
            // TODO standardise error responses rather than returning where they fail, which could
            // return an error object (with errcode) or a string.
            var errorFunc = function(error) {
                console.error("joinRoom: " + JSON.stringify(error));
                defer.reject(error);
            };
            
            resolveRoomIdentifier(roomIdOrAlias).then(function(roomId) {
                // check if you are joined already
                eventHandlerService.waitForInitialSyncCompletion().then(function() {
                    var thisRoom = modelService.getRoom(roomId);
                    var me = matrixService.config().user_id;
                    if (thisRoom.isJoinedRoom(me)) {
                        console.log("joinRoom: Already joined room "+roomId);
                        defer.resolve(roomId);
                        return;
                    }
                    // join the room and get current room state
                    thisRoom.syncing = true;
                    matrixService.join(roomIdOrAlias).then(function() {
                        matrixService.roomInitialSync(roomId, 0).then(function(response) {
                            var room = modelService.getRoom(roomId);
                            eventHandlerService.handleRoomInitialSync(room, response.data);
                            var presence = response.data.presence;
                            eventHandlerService.handleEvents(presence, false);
                            console.log("joinRoom: Joined room "+roomId);
                            thisRoom.syncing = false;
                            defer.resolve(roomId);
                        }, errorFunc);
                    }, errorFunc);
                }, errorFunc);
            }, errorFunc);
            
            return defer.promise;
        },
        
        createRoom: function(alias, isPublic, inviteList) {
            var defer = $q.defer();
            
            var errorFunc = function(error) {
                console.error("joinRoom: " + JSON.stringify(error));
                defer.reject(error);
            };
            
            matrixService.create(alias, isPublic, inviteList).then(function(response) {
                var roomId = response.data.room_id;
                matrixService.roomInitialSync(roomId, 0).then(function(syncResponse) {
                    var room = modelService.getRoom(roomId);
                    room.current_room_state.storeStateEvents(syncResponse.data.state);
                    room.old_room_state.storeStateEvents(syncResponse.data.state);
                    var presence = syncResponse.data.presence;
                    eventHandlerService.handleEvents(presence, false);
                    console.log("createRoom: Synced room "+roomId);
                    defer.resolve(roomId);
                }, errorFunc);
            }, errorFunc);
            
            return defer.promise;
        },
        
        leaveRoom: function(roomId) {
            var d = $q.defer();
            modelService.getRoom(roomId).leave().then(
                function(response) {
                    eventHandlerService.wipeDuplicateDetection(roomId);
                    d.resolve(response);
                },
                function(error) {
                    d.reject(error);
                }
            );
            return d.promise;
        },

        // Returns a promise that resolves when the initialSync request has been processed
        waitForInitialSyncCompletion: function() {
            return initialSyncDeferred.promise;
        },
        
        isInitialSyncComplete: function() {
            return initialSyncComplete;
        },
        
        // remove the ability to detect duplicates by removing known event IDs for this room.
        // Used in the event reaper service which nukes entire rooms: it needs to know that
        // the initial sync it performs will not be incorrectly dupe suppressed. Also used when
        // leaving rooms, so rejoining quickly won't suppress the sync events.
        wipeDuplicateDetection: function(roomId) {
            if (roomId in eventReapMap) {
                delete eventReapMap[roomId];
                console.log("[]? (<_<)=(>_>) ?[] Removed duplicate suppression for " + roomId);
            }
        }
    };
    return eventHandlerService;
}]);
