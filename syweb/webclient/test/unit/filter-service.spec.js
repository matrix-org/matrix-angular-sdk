describe('FilterService', function() {
    var $q, $rootScope;

    var $window = {
        localStorage: {
            getItem: function(){},
            setItem: function(){}
        }
    };

    var matrixService = {
        createFilter: function(){}
    };

    beforeEach(function() {
        module(function ($provide) {
            $provide.value('matrixService', matrixService);
            $provide.value('$window', $window);
        });
        module('filterService');
    });
    
    beforeEach(inject(function(_$q_, _$rootScope_) {
        $q = _$q_;
        $rootScope = _$rootScope_;
    }));

    it('should set Filter.id from the /filter response.', inject(
    function(filterService) {
        var token = "tok";

        var defer = $q.defer();
        spyOn(matrixService, "createFilter").and.returnValue(defer.promise);

        var f = filterService.newFilter();
        f.create();

        defer.resolve({
            data: {
                filter_id: token
            }
        })

        $rootScope.$digest();

        expect(f.id).toEqual(token);
    }));

    it('should be able to regenerate filters based on localStorage.', inject(
    function(filterService) {
        var token = "tok";
        var store = {};
        spyOn($window.localStorage, "setItem").and.callFake(function(k, v) {
            store[k] = v;
        });
        spyOn($window.localStorage, "getItem").and.callFake(function(k, v) {
            return store[k];
        });

        var defer = $q.defer();
        spyOn(matrixService, "createFilter").and.callFake(function() {
            return defer.promise;
        })

        var f = filterService.newFilter();
        var d = filterService.newDefinition();
        d.includeRooms("!foo:bar");
        f.setRoomState(d);
        f.create();

        defer.resolve({
            data: {
                filter_id: token
            }
        })
        $rootScope.$digest();
        expect($window.localStorage.setItem).toHaveBeenCalled();
        expect(f.id).toEqual(token);
        expect(f.getRoomStateDefinition().data.rooms).toEqual(["!foo:bar"]);

        // ... some time passes and the token is no longer valid...

        // make a new promise for the new matrix API call
        defer = $q.defer();
        var regeneratedFilter = undefined;
        filterService.regenerateFilter(token).then(function(filter) {
            regeneratedFilter = filter;
        });
        expect($window.localStorage.getItem).toHaveBeenCalled();
        defer.resolve({
            data: {
               filter_id: "new_tok"
            }
        });
        $rootScope.$digest();

        expect(regeneratedFilter.id).toEqual("new_tok");
        expect(regeneratedFilter.getRoomStateDefinition().data.rooms).toEqual(["!foo:bar"]);
    }));
    
    it('should be able to include rooms.', inject(
    function(filterService) {
        var roomA = "!roomA:localhost";
        var roomB = "!roomB:localhost";
        var defer = $q.defer();
        spyOn(matrixService, "createFilter").and.returnValue(defer.promise);

        var f = filterService.newFilter();
        var d = filterService.newDefinition();
        d.includeRooms([roomA, roomB]);
        f.setRoomEvents(d);
        f.create();

        expect(matrixService.createFilter).toHaveBeenCalledWith({
            room: {
                events: {
                    rooms: [roomA, roomB]
                }
            }
        });
    }));

    it('should be able to exclude rooms.', inject(
    function(filterService) {
        var roomA = "!roomA:localhost";
        var roomB = "!roomB:localhost";
        var defer = $q.defer();
        spyOn(matrixService, "createFilter").and.returnValue(defer.promise);

        var f = filterService.newFilter();
        var d = filterService.newDefinition();
        d.excludeRooms([roomA, roomB]);
        f.setPublicUserData(d);
        f.create();

        expect(matrixService.createFilter).toHaveBeenCalledWith({
            public_user_data: {
                not_rooms: [roomA, roomB]
            }
        });
    }));

    it('should be able to include types.', inject(
    function(filterService) {
        var types = ["m.*", "org.matrix.*"];
        var defer = $q.defer();
        spyOn(matrixService, "createFilter").and.returnValue(defer.promise);

        var f = filterService.newFilter();
        var d = filterService.newDefinition();
        d.includeTypes(types);
        f.setPrivateUserData(d);
        f.create();

        expect(matrixService.createFilter).toHaveBeenCalledWith({
            private_user_data: {
                types: types
            }
        });
    }));

    it('should be able to exclude types.', inject(
    function(filterService) {
        var types = ["m.*", "org.matrix.*"];
        var excludeTypes = ["com.*"];
        var defer = $q.defer();
        spyOn(matrixService, "createFilter").and.returnValue(defer.promise);

        var f = filterService.newFilter();
        var d = filterService.newDefinition();
        d.excludeTypes(excludeTypes);
        d.includeTypes(types);
        f.setRoomState(d);
        f.create();

        expect(matrixService.createFilter).toHaveBeenCalledWith({
            room: {
                state: {
                    types: types,
                    not_types: excludeTypes
                }
            }
        });
    }));

    it('should be able to include senders.', inject(
    function(filterService) {
        var senders = "@bob:localhost";
        var defer = $q.defer();
        spyOn(matrixService, "createFilter").and.returnValue(defer.promise);

        var f = filterService.newFilter();
        var d = filterService.newDefinition();
        d.includeSenders(senders);
        f.setRoomEvents(d);
        f.create();

        expect(matrixService.createFilter).toHaveBeenCalledWith({
            room: {
                events: {
                    senders: [senders]
                }
            }
        });
    }));

    it('should be able to exclude senders.', inject(
    function(filterService) {
        var senders = "@bob:localhost";
        var defer = $q.defer();
        spyOn(matrixService, "createFilter").and.returnValue(defer.promise);

        var f = filterService.newFilter();
        var d = filterService.newDefinition();
        d.excludeSenders(senders);
        f.setPublicUserData(d);
        f.create();

        expect(matrixService.createFilter).toHaveBeenCalledWith({
            public_user_data: {
                not_senders: [senders]
            }
        });
    }));

    it('should remove entries from the include list when excluding.', inject(
    function(filterService) {
        var roomA = "!roomA:localhost";
        var roomB = "!roomB:localhost";
        var roomC = "!roomC:localhost";
        var defer = $q.defer();
        spyOn(matrixService, "createFilter").and.returnValue(defer.promise);

        var f = filterService.newFilter();
        var d = filterService.newDefinition();
        d.includeRooms([roomA, roomB, roomC]);
        d.excludeRooms(roomB);
        f.setRoomState(d);
        f.create();

        expect(matrixService.createFilter).toHaveBeenCalledWith({
            room: {
                state: {
                    rooms: [roomA, roomC],
                    not_rooms: [roomB]
                }
            }
        });
    }));

    it('should remove entries from the exclude list when including.', inject(
    function(filterService) {
        var roomA = "!roomA:localhost";
        var roomB = "!roomB:localhost";
        var roomC = "!roomC:localhost";
        var defer = $q.defer();
        spyOn(matrixService, "createFilter").and.returnValue(defer.promise);

        var f = filterService.newFilter();
        var d = filterService.newDefinition();
        d.excludeRooms([roomA, roomB, roomC, roomB, roomB]);
        d.includeRooms(roomB);
        f.setRoomEvents(d);
        f.create();

        expect(matrixService.createFilter).toHaveBeenCalledWith({
            room: {
                events: {
                    not_rooms: [roomA, roomC],
                    rooms: [roomB]
                }
            }
        });
    }));

    it('should be able to accept a single entry as a string.', inject(
    function(filterService) {
        var roomA = "!roomA:localhost";
        var defer = $q.defer();
        spyOn(matrixService, "createFilter").and.returnValue(defer.promise);

        var f = filterService.newFilter();
        var d = filterService.newDefinition();
        d.excludeRooms(roomA);
        f.setPrivateUserData(d);
        f.create();

        expect(matrixService.createFilter).toHaveBeenCalledWith({
            private_user_data: {
                not_rooms: [roomA]
            }
        });
    }));
});
