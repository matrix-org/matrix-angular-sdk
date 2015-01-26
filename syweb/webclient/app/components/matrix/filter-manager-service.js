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

/*
 * This service controls which filters are set for which requests.
 */
angular.module('filterManagerService', [])
.service('filterManagerService', ['$window', '$q', 'filterService', 
function ($window, $q, filterService) {
    var that = this;
    var LS_PREFIX = "filterManagerService.filter.";

    this.REQUESTS = {
        SYNC: "sync",
        SCROLLBACK: "scrollback"
    };

    var filters = {
        // requestEnum: filterId
    };

    var loadStoredFilters = function() {
        // for each request enum, try to load the filter ID from local storage
        for (var key in that.REQUESTS) {
            if (!that.REQUESTS.hasOwnProperty(key)) continue;
            filters[that.REQUESTS[key]] = 
                $window.localStorage.getItem(LS_PREFIX + that.REQUESTS[key]);
        }
    };

    var saveFilter = function(requestEnum, filterId) {
        filters[requestEnum] = filterId;
        $window.localStorage.setItem(LS_PREFIX + requestEnum, filterId);
    };

    var createFilter = function(requestEnum) {
        console.log("createFilter -> "+requestEnum);
        var f = undefined;
        if (requestEnum === that.REQUESTS.SCROLLBACK) {
            f = filterService.newFilter();
            f.includeTypes("m.*");
        }
        else if (requestEnum === that.REQUESTS.SYNC) {
            f = filterService.newFilter();
            f.includeTypes("m.*");
        }

        if (f) {
            var defer = $q.defer();
            f.create().then(function(filter) {
                saveFilter(requestEnum, filter.id);
                defer.resolve(filter);
            },
            function(err) {
                console.error("Unable to create filter for "+requestEnum);
                defer.reject(err);
            });
            return defer.promise;
        }
        else {
            return $q.reject("Unknown enum: "+requestEnum);
        }
    };


    this.generateFilters = function() {
        loadStoredFilters();
        var promises = [];
        for (var key in that.REQUESTS) {
            if (!that.REQUESTS.hasOwnProperty(key)) continue;
            if (!filters[that.REQUESTS[key]]) {
                promises.push(createFilter(that.REQUESTS[key]));
            }
        }

        return $q.all(promises);
    };

    this.getFilterIdForRequest = function(requestEnum) {
        return filters[requestEnum];
    };

}]);


