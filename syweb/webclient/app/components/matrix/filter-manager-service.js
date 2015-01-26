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
.service('filterManagerService', ['$window', 'filterService', 
function ($window, filterService) {
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
        filters[that.REQUESTS.SYNC] = 
            $window.localStorage.getItem(LS_PREFIX + that.REQUESTS.SYNC);

        filters[that.REQUESTS.SCROLLBACK] = 
            $window.localStorage.getItem(LS_PREFIX + that.REQUESTS.SCROLLBACK);
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
            f.create().then(function(filter) {
                saveFilter(requestEnum, filter.id);
            },
            function(err) {
                console.error("Unable to create filter for "+requestEnum);
                console.error(err);
            });
        }
    };


    this.generateFilters = function() {
        loadStoredFilters();
        if (!filters[that.REQUESTS.SCROLLBACK]) {
            createFilter(that.REQUESTS.SCROLLBACK);
        }
        if (!filters[that.REQUESTS.SYNC]) {
            createFilter(that.REQUESTS.SYNC);
        }
    };

    this.getFilterIdForRequest = function(requestEnum) {
        return filters[requestEnum];
    };

}]);


