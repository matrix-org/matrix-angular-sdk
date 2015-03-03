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

angular.module('versionService', [])
.service('versionService', ['$http', '$q',
function ($http, $q) {
	var pendingVersionDefer = $q.defer();
	var versionService = this;
    versionService.version = "unknown";
    versionService.getVersion = function() {
        return pendingVersionDefer.promise;
    };

    $http.get("/VERSION").then(function(response) {
        console.log("Version %s", response.data);
        versionService.version = response.data;
        pendingVersionDefer.resolve();
    },
    function(err) {
        console.error("Failed to get web client version.");
        pendingVersionDefer.resolve();
    });

}]);


