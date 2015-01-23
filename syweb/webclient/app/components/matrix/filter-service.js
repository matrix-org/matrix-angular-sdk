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
 * This service manages the provisioning and storage of filters.
 *
 * Usage (new filter):
 *   var filter = filterService.newFilter();
 *   filter.includeRooms("!foo:bar");
 *   filter.excludeTypes("com.*");
 *   filter.includeSenders(["@alice:baz", "@bob:baz"]);
 *   filter.data.public_user_data = true;
 *   filter.create().then(function(filter) {
 *       // from now on use the token
 *       doSomething(filter.id);
 *   });
 *
 * Usage (expired token):
 *   filterService.regenerateFilter(expiredToken).then(function(filter) {
 *       // clobber expired token with new one
 *       doSomething(filter.id);
 *   });
 *
 */
angular.module('filterService', [])
.service('filterService', ['$q', '$window', 'matrixService', 
function ($q, $window, matrixService) {
    var filterService = this;
    filterService.LS_FILTER_PREFIX = "matrix.filterService.cachedFilter_";

    var Filter = function Filter() {
        this.data = {
            types: [],
            not_types: [],
            rooms: [],
            not_rooms: [],
            senders: [],
            not_senders: [],

            public_user_data: undefined, // true|false
            private_user_data: undefined, // true|false

            format: undefined, // normal/trimmed
            select: [],

            bundle_updates: undefined, // true|false
            bundle_relates_to: undefined // v2.1
        };

        this.id = undefined;
    };

    var removeAll = function(arr, item) {
        var index = arr.indexOf(item);
        while (index != -1) {
            arr.splice(index, 1);
            index = arr.indexOf(item);
        }
    };

    var addIfNotExist = function(arr, item) {
        var index = arr.indexOf(item);
        if (index === -1) {
            arr.push(item);
        }
    };

    var persistFilter = function(filter) {
        $window.localStorage.setItem(
            filterService.LS_FILTER_PREFIX + filter.id,
            JSON.stringify(filter.data)
        );
    };

    var getCachedFilterJson = function(filterToken) {
        var jsonStr = $window.localStorage.getItem(
            filterService.LS_FILTER_PREFIX + filterToken
        );
        if (jsonStr) {
            return JSON.parse(jsonStr);
        }
    };

    var provisionFilter = function(filter) {
        var defer = $q.defer();

        // strip undefined/empty array entries since they weren't used.
        var keys = Object.keys(filter.data);
        for (var i=0; i<keys.length; i++) {
            var key = keys[i];
            var val = filter.data[key];
            if ((val === undefined) || (angular.isArray(val) && val.length == 0)) {
                delete filter.data[key];
            }
        }

        matrixService.createFilter(filter.data).then(function(response) {
            filter.id = response.filter_id;
            persistFilter(filter);
            defer.resolve(filter);
        },
        function(err) {
            defer.reject(err);
        });
        return defer.promise;
    };
    
    Filter.prototype = {
        create: function() {
            return provisionFilter(this);
        },
        includeRooms: function(roomIds) {
            this._incl(this.data.rooms, this.data.not_rooms, roomIds);
        },
        excludeRooms: function(roomIds) {
            this._excl(this.data.rooms, this.data.not_rooms, roomIds);
        },
        includeTypes: function(eventTypes) {
            this._incl(this.data.types, this.data.not_types, eventTypes);
        },
        excludeTypes: function(eventTypes) {
            this._excl(this.data.types, this.data.not_types, eventTypes);
        },
        includeSenders: function(senders) {
            this._incl(this.data.senders, this.data.not_senders, senders);
        },
        excludeSenders: function(senders) {
            this._excl(this.data.senders, this.data.not_senders, senders);
        },

        _incl: function(inclArray, exclArray, items) {
            if(typeof(items) === 'string') {
                items = [items];
            }

            for (var i=0; i<items.length; i++) {
                var item = items[i];

                // remove entry from excluded array
                removeAll(exclArray, item);

                // add entry into included array
                addIfNotExist(inclArray, item);
            }
        },

        _excl: function(inclArray, exclArray, items) {
            if(typeof(items) === 'string') {
                items = [items];
            }

            for (var i=0; i<items.length; i++) {
                var item = items[i];

                // remove entry from included array
                removeAll(inclArray, item);

                // add entry into excluded array
                addIfNotExist(exclArray, item);
            }
        }
    };

    this.newFilter = function() {
        return new Filter();
    };

    // regenerate a filter from the JSON (e.g. if the HS has expired it)
    this.regenerateFilter = function(filterToken) {
        var jsonBlob = getCachedFilterJson(filterToken);
        if (jsonBlob) {
            // resubmit this
            var filter = new Filter();
            filter.data = jsonBlob;
            return filter.create();
        }
        else {
            $q.reject("Filter not found.");
        }
    };

}]);


