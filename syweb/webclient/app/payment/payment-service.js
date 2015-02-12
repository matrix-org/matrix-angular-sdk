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
.service('paymentService', ['matrixService', 'modelService', 
function (matrixService, modelService) {
    this.getCredit = function() {
        var rooms = modelService.getRooms();
        var me = matrixService.config().user_id;
        for (var roomId in rooms) {
            if (!rooms.hasOwnProperty(roomId)) continue;
            var room = rooms[roomId];
            var createEvent = room.now.state("m.room.create");
            if (!createEvent || createEvent.user_id !== "@sms:openmarket.com") {
                continue;
            }
            var creditEvent = room.now.state("com.openmarket.sms.credit", me);
            if (creditEvent && creditEvent.content) {
                if (creditEvent.content.credit) {
                    return creditEvent.content.credit;
                }
            }
        }
        return 0.0;
    };
}]);