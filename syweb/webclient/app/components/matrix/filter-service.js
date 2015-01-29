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
 *   filter.room.state.includeRooms("!foo:bar");
 *   filter.room.state.excludeTypes("com.*");
 *   filter.room.events.includeSenders(["@alice:baz", "@bob:baz"]);
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

    var Definition = function Definition(jsonData) {
        this.data = {
            types: [],
            not_types: [],
            rooms: [],
            not_rooms: [],
            senders: [],
            not_senders: []
        };
        if (jsonData) {
            this.data = jsonData;
        }
    };

    var Filter = function Filter(jsonBlob) {
        this.id = undefined;
        this.data = {
            room: {
                state: undefined, // Definition
                events: undefined // Definition
            },
            public_user_data: undefined, // Definition
            private_user_data: undefined // Definition

            /*
            format: undefined, // normal/trimmed
            select: [],

            bundle_updates: undefined, // true|false
            bundle_relates_to: undefined // v2.1 */
        };

        if (!jsonBlob) {
            return;
        }

        if (jsonBlob.public_user_data) {
            this.data.public_user_data = new Definition(jsonBlob.public_user_data);
        }
        if (jsonBlob.private_user_data) {
            this.data.private_user_data = new Definition(jsonBlob.private_user_data);
        }
        if (jsonBlob.room) {
            if (jsonBlob.room.state) {
                this.data.room.state = new Definition(jsonBlob.room.state);
            }
            if (jsonBlob.room.events) {
                this.data.room.events = new Definition(jsonBlob.room.events);
            }
        }

        
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
            JSON.stringify(filter.json())
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

        matrixService.createFilter(filter.json()).then(function(response) {
            filter.id = response.data.filter_id;
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
        json: function() {
            var filterJson = {
                room: {}
            };
            if (this.data.room.state) {
                filterJson.room.state = this.data.room.state.json();
            }
            if (this.data.room.events) {
                filterJson.room.events = this.data.room.events.json();
            }
            if (this.data.public_user_data) {
                filterJson.public_user_data = this.data.public_user_data.json();
            }
            if (this.data.private_user_data) {
                filterJson.private_user_data = this.data.private_user_data.json();
            }
            if (Object.keys(filterJson.room).length == 0) {
                delete filterJson.room;
            }
            return filterJson;
        },
        setRoomEvents: function(definition) {
            this.data.room.events = definition;
        },
        setRoomState: function(definition) {
            this.data.room.state = definition;
        },
        setPublicUserData: function(definition) {
            this.data.public_user_data = definition;
        },
        setPrivateUserData: function(definition) {
            this.data.private_user_data = definition;
        },
        getRoomEventsDefinition: function() {
            return this.data.room.events;
        },
        getRoomStateDefinition: function() {
            return this.data.room.state;
        },
        getPublicUserDataDefinition: function() {
            return this.data.public_user_data;
        },
        getPrivateUserDataDefinition: function() {
            return this.data.private_user_data;
        },
    };
    
    Definition.prototype = {
        json: function() {
            // strip undefined/empty array entries since they weren't used.
            var definition = angular.copy(this.data);
            var keys = Object.keys(definition);
            for (var i=0; i<keys.length; i++) {
                var key = keys[i];
                var val = definition[key];
                if ((val === undefined) || (angular.isArray(val) && val.length == 0)) {
                    delete definition[key];
                }
            }
            return definition;
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

    this.newDefinition = function() {
        return new Definition();
    };

    // regenerate a filter from the JSON (e.g. if the HS has expired it)
    this.regenerateFilter = function(filterToken) {
        var jsonBlob = getCachedFilterJson(filterToken);
        if (jsonBlob) {
            // resubmit this
            var filter = new Filter(jsonBlob);
            return filter.create();
        }
        else {
            $q.reject("Filter not found.");
        }
    };

}]);


