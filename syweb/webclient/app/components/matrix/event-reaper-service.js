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
This service controls when events are removed from the modelService in order to
control memory usage.
*/
angular.module('eventReaperService', [])
.factory('eventReaperService', [ '$rootScope', 'modelService', 'recentsService',
'matrixService', 'eventHandlerService',
function($rootScope, modelService, recentsService, matrixService, eventHandlerService) {


    /* Reaping strategy:
     * We want to reap rooms which have lots of events (e.g. from paginating, or from
     * leaving the app open for a while). We do not want to reap the room being viewed
     * as they may be actively paginating / interacting with the room.
     *
     * - If a room is being viewed, it cannot be reaped. Detected via BROADCAST_SELECTED_ROOM_ID
     * - If a room exceeds MAX_EVENTS events, it will be reaped. Detected via the length of room.events.
     * 
     * It is important to check for eligible rooms to reap *without any user interaction*
     * as one of the use cases we are trying to resolve here is leaving open the webapp in a
     * tab for a couple of days.
     *
     * - Lazily check rooms when an event for that room comes down the event stream. 
     *   Detected via MSG_EVENT broadcast.
     */
    var MAX_EVENTS = 50;

    var enabled = false;
    var viewingRoom = undefined;
    
    var reapRoom = function(roomIdToReap) {
        matrixService.roomInitialSync(roomIdToReap, 30).then(
        function(response) {
            console.log(" ( '-')_/` (O_O)' Reaping "+roomIdToReap);
            // nuke events and old state
            modelService.removeRoom(roomIdToReap);
            var room = modelService.getRoom(roomIdToReap);
            // remove dupe suppression on this room, else it is possible that these
            // events will be suppressed, thinking they are from the global /initialSync
            eventHandlerService.wipeDuplicateDetection(roomIdToReap);
            eventHandlerService.handleRoomInitialSync(room, response.data);
            console.log(" `\\_('-' ) (x_x) Reaped "+roomIdToReap);
        },
        function(error) {
            console.error("Failed to reap "+roomIdToReap+" : "+JSON.stringify(error));
        });
    };

    // listen for the room being viewed now
    $rootScope.$on(recentsService.BROADCAST_SELECTED_ROOM_ID, 
    function(ngEvent, roomId) {
        viewingRoom = roomId;
        console.log("Viewing => " + roomId);
    });
    
    $rootScope.$on(eventHandlerService.MSG_EVENT, 
    function(ngEvent, event, isLive) {
        if (!enabled || event.room_id === viewingRoom) {
            return;
        }
        var room = modelService.getRoom(event.room_id);
        if (room.events.length > MAX_EVENTS) {
            reapRoom(event.room_id);
        }
    });
    
    return {
        MAX_EVENTS: MAX_EVENTS,
        
        setEnabled: function(isEnabled) {
            enabled = isEnabled;
        },
        
        reap: function(roomId) {
            reapRoom(roomId);
        }
    };
    
}]);
