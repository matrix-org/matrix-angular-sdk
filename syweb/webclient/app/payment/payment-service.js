/*
 Copyright 2015 OpenMarket Ltd
 
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

angular.module('paymentService', [])
.service('paymentService', ['$http', '$window', 'matrixService', 'modelService', 
function ($http, $window, matrixService, modelService) {
    var LS_EULA = "com.openmarket.eula";
    var ADMIN_USER_ID = "@sms:matrix.openmarket.com";

    var getAccountRoom = function() {
        var rooms = modelService.getRooms();
        for (var roomId in rooms) {
            if (!rooms.hasOwnProperty(roomId)) continue;
            var room = rooms[roomId];
            var createEvent = room.now.state("m.room.create");
            if (createEvent && createEvent.user_id === ADMIN_USER_ID) {
                return room;
            }
        }
    };

    this.getCredit = function() {
        var me = "_" + matrixService.config().user_id;
        var room = getAccountRoom();
        if (room) {
            var creditEvent = room.now.state("com.openmarket.credit", me);
            if (creditEvent && creditEvent.content) {
                if (creditEvent.content.credit) {
                    if (creditEvent.content.currency == "USD") {
                        return "$" + parseFloat(creditEvent.content.credit).toFixed(2);
                    }
                    else {
                        return parseFloat(creditEvent.content.credit).toFixed(2) + " " + creditEvent.content.currency;
                    }
                }
            }
        }
        return "$0";
    };

    this.getEula = function() {
        if (!webClientConfig.paymentEulaUrl) {
            console.error("No EULA url");
            return;
        }
        var promise = $http.get(webClientConfig.paymentEulaUrl)
        return promise;
    };

    this.acceptEula = function() {
        console.log("Accepting EULA");
        $window.localStorage.setItem(LS_EULA, true);
    };

    this.hasAcceptedEula = function() {
        return $window.localStorage.getItem(LS_EULA);
    }
}]);
