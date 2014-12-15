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
 * This service controls the sending and timers for typing notifications.
 * It needs to maintain 2 timers: one for the user input (a timer which
 * when it times out means they are no longer typing), and one for the
 * server poke (which when it times out means you need to re-poke).
 */
angular.module('typingService', [])
.factory('typingService', [ '$rootScope', '$timeout', 'matrixService',
function($rootScope, $timeout, matrixService) {
    var typingService = {};


    // canonical source for rooms typing in
    var roomsTyping = {
        // room_id : true|false
    };


    // The "user timeout" is the time taken from the last character entered until they are treated
    // as having stopped typing.
    typingService.USER_TIMEOUT_MS = 5000;
    var userTimeouts = {
        // room_id: timeout
    };
    var cancelUserTimeout = function(roomId) {
        var timerPromise = userTimeouts[roomId];
        if (timerPromise) {
            $timeout.cancel(timerPromise);
        }
    };
    var startUserTimeout = function(roomId) {
        userTimeouts[roomId] = $timeout(function() {
            if (roomsTyping[roomId]) {
                console.log("[typing] user-timeout: expired "+roomId);
                roomsTyping[roomId] = false;
                stopTyping(roomId);
            }
        }, typingService.USER_TIMEOUT_MS);
    };

    // The "server timeout" is the time taken from the last server poke until another poke is required if they are still
    // typing. This is slightly less than the server-specified timeout because of propagation times.
    typingService.SERVER_TIMEOUT_MS = 25000;
    typingService.SERVER_SPECIFIED_TIMEOUT_MS = 30000;
    var serverTimeouts = {
        // room_id: timeout
    };
    var cancelServerTimeout = function(roomId) {
        var timerPromise = serverTimeouts[roomId];
        if (timerPromise) {
            $timeout.cancel(timerPromise);
        }
    };
    var startServerTimeout = function(roomId) {
        serverTimeouts[roomId] = $timeout(function() {
            console.log("[typing] server-timeout: expired. Still typing: "+roomsTyping[roomId]+" in room "+roomId);
            if (roomsTyping[roomId]) {
                startServerTimeout(roomId);
                // re-poke the server
                matrixService.setTyping(roomId, true, typingService.SERVER_SPECIFIED_TIMEOUT_MS).then(function() {
                    console.log("[typing] server-timeout: Repoked.");
                },
                function(error) {
                    console.error("[typing] server-timeout: Unable to re-poke typing notification.");
                });
            }
        }, typingService.SERVER_TIMEOUT_MS);
    };



    var stopTyping = function(roomId) {
        cancelUserTimeout(roomId);
        cancelServerTimeout(roomId);

        matrixService.setTyping(roomId, false).then(function() {
            console.log("[typing] sent stopped typing.");
        },
        function(error) {
            console.error("[typing] Unable to send stop typing in room "+roomId);
        });
    };

    var startTyping = function(roomId) {
        matrixService.setTyping(roomId, true, typingService.SERVER_SPECIFIED_TIMEOUT_MS).then(function() {
            console.log("[typing] sent started typing. starting typing timeouts in room "+roomId);
            cancelUserTimeout(roomId);
            cancelServerTimeout(roomId);
            startServerTimeout(roomId);
            startUserTimeout(roomId);
        },
        function(error) {
            console.error("[typing] Unable to send typing in room "+roomId);
        });
    };


    /*
     * Announce that you are typing (or not) in a room. This can be called
     * as often as you like, so attaching it to onchange events on an input
     * box is encouraged.
     * @param <String> The room you are typing in.
     * @param <Boolean> Truthy if you are typing.
     */
    typingService.setTyping = function(roomId, isTyping) {
        if (isTyping && !roomsTyping[roomId]) {
            // state change -> typing
            roomsTyping[roomId] = true;
            console.log("[typing] explicit start typing in room "+roomId);
            startTyping(roomId);
        }
        else if (!isTyping && roomsTyping[roomId]) {
            // state change -> not typing
            roomsTyping[roomId] = false;
            console.log("[typing] explicit stop typing in room "+roomId);
            stopTyping(roomId);
        }

        if (isTyping) {
            // restart the user timeout
            cancelUserTimeout(roomId);
            startUserTimeout(roomId);
        }
    }

    return typingService;
    
}]);
