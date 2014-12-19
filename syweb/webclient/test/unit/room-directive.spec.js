describe("RoomDirective.tabComplete", function() {
    var elm, scope;

    beforeEach(module('RoomController'));

    beforeEach(inject(function($rootScope, $compile) {
        elm = angular.element(
              "<div>" +
              '<textarea id="mainInput" tab-complete />' +
              "</div>"
        );

        scope = $rootScope;
        $compile(elm)(scope);
        scope.$digest();
        
        scope.room = {
            now: {
                members: {
                    "@alice:foo.bar": mkMember("@alice:foo.bar", "Alice"),
                    "@bob:foo.bar": mkMember("@bob:foo.bar", "Bob")
                }
            }
        };
    }));
    
    // helper methods
    var mkMember = function(userId, displayName) {
        return {
            event: {
                content: {
                    displayname: displayName
                }
            }
        };
    };
    var tabComplete = function(backwards) {
        var press = jQuery.Event("keypress");
        press.ctrlKey = false;
        if (backwards) {
            press.which = 9; // tab key
            press.shiftKey = true;
        }
        else {
            press.which = 9; // tab key
        }
        inputElm().trigger(press);
    };
    var inputElm = function() {
        return elm.find("#mainInput");
    };

    it('should tab complete a name with a ": " if at the start.', function() {
        inputElm().val("Ali");
        tabComplete();
        expect(inputElm().val()).toEqual("Alice: ");
    });
    
    it('should tab complete a name with a " " if not at the start.', function() {
        inputElm().val("Hello there Ali");
        tabComplete();
        expect(inputElm().val()).toEqual("Hello there Alice ");
    });
    
    it('should tab complete a name case-insensitively.', function() {
        inputElm().val("Hello there aLi");
        tabComplete();
        expect(inputElm().val()).toEqual("Hello there Alice ");
    });
    
    it('should tab complete multiple names with repeated tab hits in alphabetical order.', function() {
        var alexUserId = "@alex:foo.bar";
        var alooUserId = "@aloo:foo.bar";
        scope.room.now.members[alexUserId] = mkMember(alexUserId, "Alexander");
        scope.room.now.members[alooUserId] = mkMember(alooUserId, "Aloo");
        inputElm().val("Hi Al");
        tabComplete();
        expect(inputElm().val()).toEqual("Hi Alexander ");
        tabComplete();
        expect(inputElm().val()).toEqual("Hi Alice ");
        tabComplete();
        expect(inputElm().val()).toEqual("Hi Aloo ");
    });
    
    it('should tab complete in reverse order if the shift key is held.', function() {
        var alexUserId = "@alex:foo.bar";
        var alooUserId = "@aloo:foo.bar";
        scope.room.now.members[alexUserId] = mkMember(alexUserId, "Alexander");
        scope.room.now.members[alooUserId] = mkMember(alooUserId, "Aloo");
        inputElm().val("Hi Al");
        tabComplete();
        expect(inputElm().val()).toEqual("Hi Alexander ");
        tabComplete();
        expect(inputElm().val()).toEqual("Hi Alice ");
        tabComplete(true);
        expect(inputElm().val()).toEqual("Hi Alexander ");
    });
    
    it('should complete user IDs if there are no more matching display names.', function() {
        inputElm().val("Hi Al");
        tabComplete();
        expect(inputElm().val()).toEqual("Hi Alice ");
        tabComplete();
        expect(inputElm().val()).toEqual("Hi @alice:foo.bar ");
    });
    
    it('should loop back to the original input text if there are no more matches.', function() {
        var original = "Hi Al";
        inputElm().val(original);
        tabComplete(); // display name
        tabComplete(); // user id
        tabComplete(); // original
        expect(inputElm().val()).toEqual(original);
    });
});
describe("RoomDirective.commandHistory", function() {
    var elm, scope, compile;
    
    var roomId = "!foo:matrix.org";
    var session = {};
    var win = {
        sessionStorage: {
            getItem: function(key) {
                return session[key];
            },
            setItem: function(key, val) {
                session[key] = val;
            }
        }
    }

    beforeEach(function() {
        module(function ($provide) {
            $provide.value('$window', win);
        });
        module('RoomController');
    });

    beforeEach(inject(function($rootScope, $compile) {
        elm = angular.element(
              "<div>" +
              '<textarea id="mainInput" command-history="roomId" />' +
              "</div>"
        );
        scope = $rootScope;
        compile = $compile;
        scope.roomId = roomId;
    }));
    
    // helper methods
    var inputElm = function() {
        return elm.find("#mainInput");
    };
    var arrowUp = function() {
        var press = jQuery.Event("keydown");
        press.which = 38;
        inputElm().trigger(press);
    };
    var arrowDown = function() {
        var press = jQuery.Event("keydown");
        press.which = 40;
        inputElm().trigger(press);
    };

    it('should do nothing with an empty command history.', function() {
        compile(elm)(scope);
        scope.$digest();
        
        inputElm().val("");
        arrowUp();
        expect(inputElm().val()).toEqual("");
    });
    
    it('should use command history from session storage.', function() {
        session["history_"+roomId] = '["messageA", "messageB", "messageC"]';
        compile(elm)(scope);
        scope.$digest();
    
        inputElm().val("");
        arrowUp();
        expect(inputElm().val()).toEqual("messageA");
    });
    
    it('should be able to navigate the command history.', function() {
        session["history_"+roomId] = '["messageA", "messageB", "messageC"]';
        compile(elm)(scope);
        scope.$digest();
    
        inputElm().val("input");
        arrowUp();
        expect(inputElm().val()).toEqual("messageA");
        arrowUp();
        expect(inputElm().val()).toEqual("messageB");
        arrowUp();
        expect(inputElm().val()).toEqual("messageC");
        arrowDown();
        expect(inputElm().val()).toEqual("messageB");
        arrowUp();
        expect(inputElm().val()).toEqual("messageC");
        arrowUp();
        expect(inputElm().val()).toEqual("messageC");
        arrowDown();
        expect(inputElm().val()).toEqual("messageB");
        arrowDown();
        expect(inputElm().val()).toEqual("messageA");
    });
    
    it('should return to the original input if you hit down.', function() {
        session["history_"+roomId] = '["messageA", "messageB", "messageC"]';
        compile(elm)(scope);
        scope.$digest();
    
        inputElm().val("input");
        arrowUp();
        expect(inputElm().val()).toEqual("messageA");
        arrowUp();
        expect(inputElm().val()).toEqual("messageB");
        arrowDown();
        expect(inputElm().val()).toEqual("messageA");
        arrowDown();
        expect(inputElm().val()).toEqual("input");
    });
    
    it('should add new text to the command history and to session storage.', function() {
        session["history_"+roomId] = '["messageA"]';
        compile(elm)(scope);
        scope.$digest();
        
        var newMsg = "msg 0";
        scope.$broadcast("commandHistory:BROADCAST_NEW_HISTORY_ITEM(item)", newMsg);
    
        inputElm().val("");
        arrowUp();
        expect(inputElm().val()).toEqual(newMsg);
        expect(session["history_"+roomId]).toEqual('["msg 0","messageA"]');
    });
}); 

