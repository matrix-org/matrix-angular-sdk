describe('EventReaperService', function() {
    var q, scope;

    // mock dependencies
    var matrixService = {
        roomInitialSync: function(roomId, limit) { 
            return {};
        }
    };
    
    var modelService = {
        removeRoom: function(roomId){},
        getRoom: function(roomId){return {};}
    };
    
    var eventHandlerService = {
        wipeDuplicateDetection: function(roomId) {},
        handleRoomInitialSync: function(room, response) {}
    };
    
    var recentsService = {
        BROADCAST_SELECTED_ROOM_ID: "BROADCAST_SELECTED_ROOM_ID"
    };

    // setup the dependencies
    beforeEach(function() {
    
        // reset test data
        
    
        // dependencies
        module(function ($provide) {
          $provide.value('matrixService', matrixService);
          $provide.value('modelService', modelService);
          $provide.value('recentsService', recentsService);
          $provide.value('eventHandlerService', eventHandlerService);
        });
        
        // tested service
        module('eventReaperService');
    });
    
    beforeEach(inject(function($q, $rootScope) {
        q = $q;
        scope = $rootScope;
    }));

    xit('should not reap rooms if it is not enabled.', inject(
    function(eventReaperService) {
    }));
    
    it('should be able to reap a room.', inject(
    function(eventReaperService) {
        var roomId = "!reaper:matrix.org";
        spyOn(modelService, "removeRoom");
        spyOn(eventHandlerService, "wipeDuplicateDetection");
        spyOn(eventHandlerService, "handleRoomInitialSync");
        spyOn(matrixService, "roomInitialSync").and.callFake(function() {
            var defer = q.defer();
            defer.resolve({
                data: {
                    state: [],
                    messages: [],
                    presence: []
                }
            });
            return defer.promise;
        });
        
        eventReaperService.reap(roomId);
        scope.$digest();
        
        expect(modelService.removeRoom).toHaveBeenCalledWith(roomId);
        expect(eventHandlerService.wipeDuplicateDetection).toHaveBeenCalledWith(roomId);
        expect(eventHandlerService.handleRoomInitialSync).toHaveBeenCalled();
    }));
    
    xit('should not reap the room being viewed currently.', inject(
    function(eventReaperService) {
    
    }));
    
    xit('should reap rooms with more than 100 events.', inject(
    function(eventReaperService) {
    
    }));
});
