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
This service serves as the entry point for all models in the app. If access to
underlying data in a room is required, then this service should be used as the
dependency.
*/
// NB: This is more explicit than linking top-level models to $rootScope
//     in that by adding this service as a dep you are clearly saying "this X
//     needs access to the underlying data store", rather than polluting the
//     $rootScope.
angular.module('modelService', [])
.factory('modelService', ['matrixService', '$rootScope', '$q',
function(matrixService, $rootScope, $q) {
    var LIVE_MESSAGE_EVENT = "modelService.LIVE_MESSAGE_EVENT(event)";
    var NEW_ROOM = "modelService.NEW_ROOM(room)";

    // alias / id lookups
    var roomIdToAlias, aliasToRoomId;
    var setRoomIdToAliasMapping = function(roomId, alias) {
        roomIdToAlias[roomId] = alias;
        aliasToRoomId[alias] = roomId;
    };
    
    // user > room member lookups
    var userIdToRoomMember;
    
    // main store
    var rooms, roomList, users;
    
    var init = function() {
        roomIdToAlias = {};
        aliasToRoomId = {};
        userIdToRoomMember = {
            // user_id: [RoomMember, RoomMember, ...]
        };
        
        // rooms are stored here when they come in.
        rooms = {
            // roomid: <Room>
        };
        
        roomList = [];
        
        users = {
            // user_id: <User>
        };
    };
    
    init();
    
    /***** Room Object *****/
    var Room = function Room(room_id) {
        this.room_id = room_id;
        this.old_room_state = new RoomState();
        this.current_room_state = new RoomState();
        this.now = this.current_room_state; // makes html access shorter
        this.aevents = []; // AnnotatedEvents which can be displayed on the UI.
        
        // some pre-calculated cached information
        this.lastAnnotatedEvent = undefined;
        this.name = room_id;
    };
    Room.prototype = {
        addMessageEvents: function addMessageEvents(events, toFront) {
            for (var i=0; i<events.length; i++) {
                this.addMessageEvent(events[i], toFront);
            }
        },
        
        addMessageEvent: function addMessageEvent(event, toFront) {
            var aEvent = new AnnotatedEvent(event);
            this.setMessageMemberInfo(aEvent, toFront);
            if (toFront) {
                this.aevents.unshift(aEvent);
                if (!this.lastAnnotatedEvent) {
                    this.lastAnnotatedEvent = aEvent;
                }
            }
            else {
                this.aevents.push(aEvent);
                this.lastAnnotatedEvent = aEvent;
                $rootScope.$broadcast(LIVE_MESSAGE_EVENT, aEvent);
            }
            return aEvent;
        },
        
        addOrReplaceMessageEvent: function addOrReplaceMessageEvent(event, toFront) {
            // Start looking from the tail since the first goal of this function 
            // is to find a message among the latest ones
            for (var i = this.aevents.length - 1; i >= 0; i--) {
                var storedEvent = this.aevents[i];
                if (storedEvent.event.event_id === event.event_id) {
                    // It's clobbering time!
                    this.aevents[i] = new AnnotatedEvent(event);
                    this.setMessageMemberInfo(this.aevents[i], toFront);
                    return this.aevents[i];
                }
            }
            return this.addMessageEvent(event, toFront);
        },
        
        setMessageMemberInfo: function(aEvent, toFront) {
            // every message must reference the RoomMember which made it *at
            // that time* so things like display names display correctly.
            var stateAtTheTime = toFront ? this.old_room_state : this.current_room_state;
            aEvent.sender = stateAtTheTime.members[aEvent.event.user_id];
            
            if (aEvent.event.type === "m.room.member") {
                if (aEvent.event.content.membership === "invite") {
                    // give information on both the inviter and invitee
                    aEvent.target = stateAtTheTime.getStateEvent("m.room.member", aEvent.event.state_key);
                }
                
                var changed_key = this.getChangedKeyForMemberEvent(aEvent.event);
                if (changed_key) {
                    aEvent.changed_key = changed_key;
                }
            }
            
            return aEvent;
        },
        
        getAnnotatedEvent: function(eventId) {
            // typically for dupe detection, so start at the end and work back
            for (var i = this.aevents.length - 1; i >= 0; i--) {
                var storedEvent = this.aevents[i];
                if (storedEvent.event.event_id == eventId) {
                    return storedEvent;
                }
            }
        },
        
        removeEvent: function(event) {
            for (var i=0; i<this.aevents.length; i++) {
                if (this.aevents[i].event == event) {
                    this.aevents.splice(i, 1);
                    return;
                }
            }
        },
        
        getChangedKeyForMemberEvent: function(event) {
            var memberChanges = undefined;
        
            // could be a membership change, display name change, etc.
            // Find out which one.
            if ((event.prev_content === undefined && event.content.membership) || (event.prev_content && (event.prev_content.membership !== event.content.membership))) {
                memberChanges = "membership";
            }
            else if (event.prev_content && (event.prev_content.displayname !== event.content.displayname)) {
                memberChanges = "displayname";
            }
            return memberChanges;
        },
        
        // mutate the member for the room state being modified.
        mutateRoomMemberState: function(event, isLive) {
            var changed_key = this.getChangedKeyForMemberEvent(event);
            var userId = event.state_key;
            if (isLive) {
                this.current_room_state.storeStateEvent(event);
                
                // work out the new name for this user.
                var member = this.current_room_state.members[userId];
                member.name = member.event.content.displayname;
                if (!member.name) {
                    member.name = userId;
                }
            }
            else { // old event
                // the m.room.member event we are handling is the NEW event. When
                // we keep going back in time, we want the PREVIOUS value for displaying
                // names/etc, hence the check here.
                var targetContent = event.prev_content ? event.prev_content : event.content;

                if (changed_key === "membership" && event.content.membership === "join") {
                    // join has a prev_content but it doesn't contain all the info unlike the join, so use that.
                    targetContent = event.content;
                }
                this.old_room_state.storeStateEvent(event);
                // work out the new name for this user.
                var member = this.old_room_state.members[userId];
                member.name = targetContent.displayname;
                if (!member.name) {
                    member.name = userId;
                }
            }
        },
        
        leave: function() {
            var d = $q.defer();
            var roomId = this.room_id;
            matrixService.leave(roomId).then(function(response) {
                delete rooms[roomId];
                d.resolve(response);
            },
            function(error) {
                d.reject(error);
            });
            
            return d.promise;
        },
        
        getMembershipState: function(user_id) {
            var member = this.current_room_state.members[user_id];
            if (member && member.event.content && member.event.content.membership) {
                return member.event.content.membership;
            };
        },
        
        isJoinedRoom: function(user_id) {
            return this.getMembershipState(user_id) === "join";
        }
    };
    
    /***** Room State Object *****/
    var RoomState = function RoomState() {
        // list of RoomMember
        this.members = {}; 
        // state events, the key is a compound of event type + state_key
        this.state_events = {}; 
        this.pagination_token = "";
    };
    RoomState.prototype = {
        // get a state event for this room from this.state_events. State events
        // are unique per type+state_key tuple, with a lot of events using 0-len
        // state keys. To make it not Really Annoying to access, this method is
        // provided which can just be given the type and it will return the 
        // 0-len event by default.
        state: function state(type, state_key) {
            if (!type) {
                return undefined; // event type MUST be specified
            }
            if (!state_key) {
                return this.state_events[type]; // treat as 0-len state key
            }
            return this.state_events[type + state_key];
        },
        
        storeStateEvent: function storeState(event) {
            var keyIndex = event.state_key === undefined ? event.type : event.type + event.state_key;
            this.state_events[keyIndex] = event;
            if (event.type === "m.room.member") {
                var userId = event.state_key;
                var rm = new RoomMember();
                rm.event = event;
                rm.user = users[userId];
                rm.name = event.content.displayname ? event.content.displayname : userId;
                rm.aevent = new AnnotatedEvent(event);
                this.members[userId] = rm;
                
                // work out power level for this room member
                var powerLevelEvent = this.state_events["m.room.power_levels"];
                if (powerLevelEvent) {
                    this.calculatePowerLevel(powerLevelEvent, rm);
                }
                
                // add to lookup so new m.presence events update the user
                if (!userIdToRoomMember[userId]) {
                    userIdToRoomMember[userId] = [];
                }
                userIdToRoomMember[userId].push(rm);
            }
            else if (event.type === "m.room.aliases") {
                setRoomIdToAliasMapping(event.room_id, event.content.aliases[0]);
            }
            else if (event.type === "m.room.power_levels") {
                for (var user_id in this.members) {
                    if (!this.members.hasOwnProperty(user_id)) continue;
                    var rm = this.members[user_id];
                    if (!rm) {
                        continue;
                    }
                    this.calculatePowerLevel(event, rm);
                }
            }
        },
        
        getMaxPowerLevel: function(powerLevelEvent) {
            var maxPowerLevel = 0;
            var userList = powerLevelEvent.content.users;
            
            for (var user_id in userList) {
                if (!userList.hasOwnProperty(user_id) || user_id === "hsob_ts") continue; // XXX hsob_ts on some old rooms :(
                maxPowerLevel = Math.max(maxPowerLevel, userList[user_id]);
            }
            return maxPowerLevel;
        },
        
        calculatePowerLevel: function(powerLevelEvent, roomMember) {
            var user_id = roomMember.event.state_key;
            // normalise power levels: find the max first.
            var maxPowerLevel = this.getMaxPowerLevel(powerLevelEvent);
            // set power level f.e room member
            var defaultPowerLevel = powerLevelEvent.content.users_default === undefined ? 0 : powerLevelEvent.content.users_default;
            
            roomMember.power_level = powerLevelEvent.content.users[user_id] === undefined ? defaultPowerLevel : powerLevelEvent.content.users[user_id];
            roomMember.power_level_norm = ((roomMember.power_level * 25) / maxPowerLevel) | 0;
        },
        
        storeStateEvents: function storeState(events) {
            if (!events) {
                return;
            }
            for (var i=0; i<events.length; i++) {
                this.storeStateEvent(events[i]);
            }
        },
        
        getStateEvent: function getStateEvent(event_type, state_key) {
            return this.state_events[event_type + state_key];
        }
    };
    
    /***** Room Member Object *****/
    var RoomMember = function RoomMember() {
        this.event = {}; // the m.room.member event representing the RoomMember.
        this.aevent = {}; // the m.room.member AnnotatedEvent
        this.power_level_norm = 0;
        this.power_level = 0;
        this.typing = false; // true if m.typing sez so
        // the calculated name of this member depending on the room state
        this.name = undefined;
        // the User: the current up-to-date info for this member
        this.user = undefined; 
    };

    /***** User Object *****/
    var User = function User() {
        // the m.presence event representing the User globally (not specific to any room)
        this.event = {};
        // used with last_active_ago to work out last seen times
        this.last_updated = 0;
    };
    
    
    /***** AnnotatedEvent Object *****/
    var AnnotatedEvent = function AnnotatedEvent(e) {
        this.event = e ? e : {};
        this.sender = undefined; // the RoomMember who sent the event
        this.target = undefined; // the target RoomMember for events with actions (invite/kick/ban)
        this.send_state = undefined; // Can be 'unsent' or 'pending' depending on the send status.
        this.changed_key = undefined; // the name of the key which changed for m.room.member events
        this.e = this.event; // alias for this.event for html (less typing)
    };
    
    AnnotatedEvent.prototype = {
        httpUri: function(uri, width, height, resizeMethod) {
            if (!typeof uri === "string" || !uri) {
                return uri;
            }
            if (uri.indexOf("mxc://") === 0) {
                return matrixService.getHttpUriForMxc(uri, width, height, resizeMethod);
            }
            return uri;
        },
        identicon: function(width, height) {
            var userId = undefined;
            if (this.event && this.event.user_id) {
                userId = this.event.user_id;
            }
            return matrixService.getIdenticonUri(userId, width, height);
        }
    };
    
    
    return {
        LIVE_MESSAGE_EVENT: LIVE_MESSAGE_EVENT,
        NEW_ROOM: NEW_ROOM,
    
        getRoom: function(roomId) {
            if(!rooms[roomId]) {
                rooms[roomId] = new Room(roomId);
                roomList.push(rooms[roomId]);
                $rootScope.$emit(NEW_ROOM, rooms[roomId]);
            }
            return rooms[roomId];
        },
        
        getKnownRoom: function(room_id_or_alias) {
            if (rooms[room_id_or_alias]) {
                return rooms[room_id_or_alias];
            }
            // check aliases
            if (aliasToRoomId[room_id_or_alias]) {
                return rooms[aliasToRoomId[room_id_or_alias]];
            }
        },
        
        removeRoom: function(roomId) {
            delete rooms[roomId];
            for (var i in roomList) { // XXX: linear search
                if (roomId === roomList[i]) {
                    roomList.splice(i, 1);
                    break;
                }
            }
            console.log("Deleted room "+roomId);
        },
        
        getRooms: function() {
            return rooms;
        },
        
        getRoomList: function() {
            return roomList;
        },
        
        /**
         * Get the member object of a room member
         * @param {String} room_id the room id
         * @param {String} user_id the id of the user
         * @returns {undefined | Object} the member object of this user in this room if he is part of the room
         */
        getMember: function(room_id, user_id) {
            var room = this.getRoom(room_id);
            return room.current_room_state.members[user_id];
        },
        
        createRoomIdToAliasMapping: function(roomId, alias) {
            setRoomIdToAliasMapping(roomId, alias);
        },
        
        getRoomIdToAliasMapping: function(roomId) {
            var alias = roomIdToAlias[roomId];
            //console.log("looking for alias for " + roomId + "; found: " + alias);
            return alias;
        },

        getAliasToRoomIdMapping: function(alias) {
            var roomId = aliasToRoomId[alias];
            //console.log("looking for roomId for " + alias + "; found: " + roomId);
            return roomId;
        },
        
        getUser: function(user_id) {
            return users[user_id];
        },
        
        setUser: function(event) {
            var usr = new User();
            usr.event = event;
            
            // migrate old data but clobber matching content keys
            if (users[event.content.user_id] && users[event.content.user_id].event) {
                usr = users[event.content.user_id];
                angular.extend(usr.event.content, event.content);
            }
            else {
                users[event.content.user_id] = usr;
            }
            
            usr.last_updated = new Date().getTime();
            
            // update room members
            var roomMembers = userIdToRoomMember[event.content.user_id];
            if (roomMembers) {
                for (var i=0; i<roomMembers.length; i++) {
                    var rm = roomMembers[i];
                    rm.user = usr;
                }
            }
        },
        
        /**
         * Return the power level of an user in a particular room
         * @param {String} room_id the room id
         * @param {String} user_id the user id
         * @returns {Number}
         */
        getUserPowerLevel: function(room_id, user_id) {
            var powerLevel = 0;
            var room = this.getRoom(room_id).current_room_state;
            if (room.state("m.room.power_levels")) {
                if (user_id in room.state("m.room.power_levels").content.users) {
                    powerLevel = room.state("m.room.power_levels").content.users[user_id];
                }
                else {
                    // Use the room default user power
                    powerLevel = room.state("m.room.power_levels").content["users_default"];
                }
            }
            return powerLevel;
        },
        
        /**
         * Compute the room users number, ie the number of members who has joined the room.
         * @param {String} room_id the room id
         * @returns {undefined | Number} the room users number if available
         */
        getUserCountInRoom: function(room_id) {
            var memberCount;

            var room = this.getRoom(room_id);
            memberCount = 0;
            for (var i in room.current_room_state.members) {
                if (!room.current_room_state.members.hasOwnProperty(i)) continue;

                var member = room.current_room_state.members[i].event;

                if ("join" === member.content.membership) {
                    memberCount = memberCount + 1;
                }
            }

            return memberCount;
        },
        
        clearRooms: function() {
            init();
        }
    
    };
}]);
