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

    var enabled = false;
    var roomViewHistory = [];
    
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
        if (!enabled || !roomId) {
            return;
        }
        roomViewHistory.push(roomId);
        while (roomViewHistory.length > 3) { // reap the earliest one
            var roomIdToReap = roomViewHistory.shift();
            reapRoom(roomIdToReap);
        }
    });
    
    return {
        setEnabled: function(isEnabled) {
            enabled = isEnabled;
        }
    };
    
}]);
