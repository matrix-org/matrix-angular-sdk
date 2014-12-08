describe("RecentsController ", function() {
    var rootScope, scope, ctrl, $q;
    
    // test vars
    var testInitialSyncDefer, testSelectedRoomId, testRooms;
    
    
    var modelService = {
        getRooms: function(){
            return testRooms;
        }
    };
    
    var recentsService = {
        getSelectedRoomId: function() {
            return testSelectedRoomId;
        },
        getUnreadMessages: function() {
        
        },
        getUnreadBingMessages: function() {
        
        },
        markAsRead: function(roomId) {},
        
        BROADCAST_UNREAD_MESSAGES: "BROADCAST_UNREAD_MESSAGES",
        BROADCAST_SELECTED_ROOM_ID: "BROADCAST_SELECTED_ROOM_ID",
        BROADCAST_UNREAD_BING_MESSAGES: "BROADCAST_UNREAD_BING_MESSAGES"
        
    };
    
    var eventHandlerService = {
        waitForInitialSyncCompletion: function(){
            return testInitialSyncDefer.promise;
        }
    };
    
    
    beforeEach(function() {
        module('matrixWebClient');
    });

    beforeEach(inject(function($rootScope, $injector, $controller, _$q_) {
            $q = _$q_;
            scope = $rootScope.$new();
            rootScope = $rootScope;
            rootScope.goToPage = function(){}
            
            // reset test vars
            testInitialSyncDefer = $q.defer();
            testSelectedRoomId = undefined;
            testRooms = {
                "!aaa:localhost": {},
                "!bbb:localhost": {}
            };
            
            ctrl = $controller('RecentsController', {
                '$scope': scope,
                'modelService': modelService,
                'recentsService': recentsService,
                'eventHandlerService': eventHandlerService
            });
        })
    );

    it('should flag when initialSync is complete so the spinner can be dismissed.', function() {
        expect(scope.doneInitialSync).toBe(false);
        testInitialSyncDefer.resolve("");
        scope.$digest();
        expect(scope.doneInitialSync).toBe(true);
    });
    
    it('should track the selected room ID so it can be highlighted correctly.', function() {
        expect(scope.recentsSelectedRoomID).toEqual(testSelectedRoomId);
        var roomId = "!aaa:localhost";
        scope.$broadcast(recentsService.BROADCAST_SELECTED_ROOM_ID, roomId);
        expect(scope.recentsSelectedRoomID).toEqual(roomId);
    });
    
    it('should mark a room as read when it is selected.', function() {
        spyOn(recentsService, "markAsRead");
        expect(recentsService.markAsRead).not.toHaveBeenCalled();
        var roomId = "!bbb:localhost";
        scope.selectRoom({}, {
            room_id: roomId
        });
        expect(recentsService.markAsRead).toHaveBeenCalledWith(roomId);
    });
});
