/*
 Copyright 2014 OpenMarket Ltd
 
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

angular.module('RoomController')
// XXX FIXME : This has tight coupling with $scope.room.now.members
.directive('tabComplete', ['$timeout', function ($timeout) {
    return function (scope, element, attrs) {
        element.on("keydown keypress", function (event) {
            // console.log("event: " + event.which);
            var TAB = 9;
            var SHIFT = 16;
            var keypressCode = event.which;
            if (keypressCode === TAB) {
                if (!scope.tabCompleting) { // cache our starting text
                    scope.tabCompleteOriginal = element[0].value;
                    scope.tabCompleting = true;
                    scope.tabCompleteIndex = 0;
                }
                
                // loop in the right direction
                if (event.shiftKey) {
                    scope.tabCompleteIndex--;
                    if (scope.tabCompleteIndex < 0) {
                        // wrap to the last search match, and fix up to a real
                        // index value after we've matched
                        scope.tabCompleteIndex = Number.MAX_VALUE;
                    }
                }
                else {
                    scope.tabCompleteIndex++;
                }
                

                var searchIndex = 0;
                var targetIndex = scope.tabCompleteIndex;
                var text = scope.tabCompleteOriginal;
                
                // console.log("targetIndex: " + targetIndex + ", 
                // text=" + text);
                                    
                // FIXME: use the correct regexp to recognise userIDs --M
                //
                // XXX: I don't really know what the point of this is. You
                // WANT to match freeform text given you want to match display
                // names AND user IDs. Surely you just want to get the last
                // word out of the input text and that's that?
                // Am I missing something here? -- Kegan
                //
                // You're not missing anything - my point was that we should
                // explicitly define the syntax for user IDs /somewhere/.
                // Meanwhile as long as the delimeters are well defined, we
                // could just pick "the last word".  But to know what the
                // correct delimeters are, we probably do need a formal
                // syntax for user IDs to refer to... --Matthew
                
                var search = /@?([a-zA-Z0-9_\-:\.]+)$/.exec(text);

                if (targetIndex === 0) { // 0 is always the original text
                    element[0].value = text;                    
                    // Force angular to wake up and update the input ng-model 
                    // by firing up input event
                    angular.element(element[0]).triggerHandler('input');
                }
                else if (search && search[1]) {
                    // console.log("search found: " + search+" from "+text);
                    var expansion;
                    
                    // FIXME: could do better than linear search here
                    angular.forEach(scope.room.now.members, function(item, name) {
                        if (item.event.content.displayname && searchIndex < targetIndex) {
                            if (item.event.content.displayname.toLowerCase().indexOf(search[1].toLowerCase()) === 0) {
                                expansion = item.event.content.displayname;
                                searchIndex++;
                            }
                        }
                    });
                    if (searchIndex < targetIndex) { // then search raw mxids
                        angular.forEach(scope.room.now.members, function(item, name) {
                            if (searchIndex < targetIndex) {
                                // === 1 because mxids are @username
                                if (name.toLowerCase().indexOf(search[1].toLowerCase()) === 1) {
                                    expansion = name;
                                    searchIndex++;
                                }
                            }
                        });
                    }
                    
                    if (searchIndex === targetIndex || 
                            targetIndex === Number.MAX_VALUE) {
                        // xchat-style tab complete, add a colon if tab 
                        // completing at the start of the text
                        if (search[0].length === text.length)
                            expansion += ": ";
                        else
                            expansion += " ";
                        element[0].value = text.replace(/@?([a-zA-Z0-9_\-:\.]+)$/, expansion);
                        // cancel blink
                        element[0].className = "";     
                        if (targetIndex === Number.MAX_VALUE) {
                            // wrap the index around to the last index found
                            scope.tabCompleteIndex = searchIndex;
                            targetIndex = searchIndex;
                        }
                    }
                    else {
                        // console.log("wrapped!");
                        element[0].className = "blink"; // XXX: slightly naughty to bypass angular
                        $timeout(function() {
                             element[0].className = "";
                        }, 150);
                        element[0].value = text;
                        scope.tabCompleteIndex = 0;
                    }

                    // Force angular to wak up and update the input ng-model by
                    // firing up input event
                    angular.element(element[0]).triggerHandler('input');
                }
                else {
                    scope.tabCompleteIndex = 0;
                }
                // prevent the default TAB operation (typically focus shifting)
                event.preventDefault();
            }
            else if (keypressCode !== SHIFT && scope.tabCompleting) {
                scope.tabCompleting = false;
                scope.tabCompleteIndex = 0;
            }
        });
        scope.$on('$destroy', function() {
            element.off("keydown keypress");
            scope = null;
        });
    };
}])
// A directive which stores text sent into it and restores it via up/down arrows
.directive('commandHistory', [ function() {
    var BROADCAST_NEW_HISTORY_ITEM = "commandHistory:BROADCAST_NEW_HISTORY_ITEM(item)";

    // Manage history of typed messages
    // History is saved in sessionStorage so that it survives when the user
    // navigates through the rooms and when it refreshes the page
    var history = {
        // The list of typed messages. Index 0 is the more recents
        data: [],

        // The position in the history currently displayed
        position: -1,
        
        element: undefined,
        roomId: undefined,

        // The message the user has started to type before going into the history
        typingMessage: undefined,

        // Init/load data for the current room
        init: function(element, roomId) {
            this.roomId = roomId;
            this.element = element;
            var data = sessionStorage.getItem("history_" + this.roomId);
            if (data) {
                this.data = JSON.parse(data);
            }
        },

        // Store a message in the history
        push: function(message) {
            this.data.unshift(message);

            // Update the session storage
            sessionStorage.setItem("history_" + this.roomId, JSON.stringify(this.data));

            // Reset history position
            this.position = -1;
            this.typingMessage = undefined;
        },

        // Move in the history
        go: function(offset) {

            if (-1 === this.position) {
                // User starts to go to into the history, save the current line
                this.typingMessage = this.element.val();
            }
            else {
                // If the user modified this line in history, keep the change
                this.data[this.position] = this.element.val();
            }

            // Bounds the new position to valid data
            var newPosition = this.position + offset;
            newPosition = Math.max(-1, newPosition);
            newPosition = Math.min(newPosition, this.data.length - 1);
            this.position = newPosition;

            if (-1 !== this.position) {
                // Show the message from the history
                this.element.val(this.data[this.position]);
            }
            else if (undefined !== this.typingMessage) {
                // Go back to the message the user started to type
                this.element.val(this.typingMessage);
            }
        }
    };

    return {
        restrict: "AE",
        scope: {
            roomId: "=commandHistory"
        },
        link: function (scope, element, attrs) {
            element.on("keydown", function (event) {
                var keycodePressed = event.which;
                var UP_ARROW = 38;
                var DOWN_ARROW = 40;
                if (scope.roomId) {
                    if (keycodePressed === UP_ARROW) {
                        history.go(1);
                        event.preventDefault();
                    }
                    else if (keycodePressed === DOWN_ARROW) {
                        history.go(-1);
                        event.preventDefault();
                    }
                }
            });
            
            var unreg = scope.$on(BROADCAST_NEW_HISTORY_ITEM, function(ngEvent, item) {
                history.push(item);
            });
            
            history.init(element, scope.roomId);
            
            scope.$on('$destroy', function() {
                element.off("keydown");
                unreg();
                scope = null;
            });
        },
        
    }
}])

// A directive to anchor the scroller position at the bottom when the browser is resizing.
// When the screen resizes, the bottom of the element remains the same, not the top.
.directive('keepScroll', ['$window', function($window) {
    return {
        link: function(scope, elem, attrs) {

            scope.windowHeight = $window.innerHeight;

            // Listen to window size change
            angular.element($window).on('resize', function() {

                // If the scroller is scrolled to the bottom, there is nothing to do.
                // The browser will move it as expected
                if (elem.scrollTop() + elem.height() !== elem[0].scrollHeight) {
                    // Else, move the scroller position according to the window height change delta
                    var windowHeightDelta = $window.innerHeight - scope.windowHeight;
                    elem.scrollTop(elem.scrollTop() - windowHeightDelta);
                }

                // Store the new window height for the next screen size change
                scope.windowHeight = $window.innerHeight;
            });
            
            scope.$on('$destroy', function() {
                angular.element($window).off('resize');
                scope = null;
            });
        }
    };
}])

// taken from http://stackoverflow.com/questions/14596213/shrink-div-to-text-thats-wrapped-to-its-max-width
.directive('fixWidth', ['$timeout', function ($timeout) {
    return {
        restrict: "A",
        scope: {
            enabled: '=fixWidth'
        },
        link: function(scope, el, attrs) {
            if (!scope.enabled) return;
            
            $timeout(function() {
                // This function gets the length of some text
                // by adding a span to the container then getting its length.
                var getLength = function (txt) {
                    var span = new $("<span />");
                    if (txt == ' ')
                        span.html('&nbsp;');
                    else
                        span.text(txt);
                    el.append(span);
                    var len = span[0].getBoundingClientRect().width;
                    span.remove();
                    return len;
                };
            
                var words = el.text().split(' ');
                var lengthOfSpace = getLength(' ');
                var lengthOfLine = 0;
                // FIXME: horrible hack to consider the grandparent rather than the span itself.
                // This obviously shouldn't be hardcoded to the DOM structure
                var maxElementWidth = el.parent().parent().width();
                var maxLineLengthSoFar = 0;
                for (var i = 0; i < words.length; i++) {
                    // Duplicate spaces will create empty entries.
                    if (words[i] == '')
                        continue;
                    // Get the length of the current word
                    var curWord = getLength(words[i]);
                    // Determine if adding this word to the current line will make it break
                    if ((lengthOfLine + (i == 0 ? 0 : lengthOfSpace) + curWord) > maxElementWidth) {
                        // If it will, see if the line we've built is the longest so far
                        if (lengthOfLine > maxLineLengthSoFar) {
                            //console.log("longest line so far splits before index " + i + " (word " + words[i] + " with width " + curWord + ") at width " + lengthOfLine);
                            maxLineLengthSoFar = lengthOfLine;
                            lengthOfLine = 0;
                        }
                    }
                    else // No break yet, keep building the line
                        lengthOfLine += (i == 0 ? 0 : lengthOfSpace) + curWord;
                }
                // If there are no line breaks maxLineLengthSoFar will be 0 still. 
                // In this case we don't actually need to set the width as the container 
                // will already be as small as possible.
                if (maxLineLengthSoFar != 0) {
                    // FIXME: horrible hack to consider the grandparent rather than the span itself.
                    // This obviously shouldn't be hardcoded to the DOM structure
                    el.parent().parent().css({ width: (maxLineLengthSoFar) + "px" });
                }
            });
        }
    }
}])

// taken from http://stackoverflow.com/questions/18368485/angular-js-resizable-div-directive
.directive('resizer', function($document) {

    return function($scope, $element, $attrs) {

        var clickX, clickY;
        
        $element.on('mousedown', function(event) {
            event.preventDefault();

            clickX = event.pageX;
            clickY = event.pageY;
            
            $document.on('mousemove', mousemove);
            $document.on('mouseup', mouseup);
        });
        
        $scope.$on('$destroy', function() {
            $element.off('mousedown');
            $document.off('mousemove', mousemove);
            $document.off('mouseup', mouseup);
            $scope = null;
        });
        
        function mousemove(event) {

            if ($attrs.resizer == 'vertical') {
                // Handle vertical resizer
                var x = event.pageX - $($attrs.resizerLeft).offset().left;

                if ($attrs.resizerMax && x > $attrs.resizerMax) {
                    x = parseInt($attrs.resizerMax);
                }
                
                if (x < -$attrs.resizerWidth) {
                    x = -$attrs.resizerWidth;
                }

                $element.css({
                    left: x + 'px'
                });

                $($attrs.resizerLeft).css({
                    width: x + 'px'
                });
                $($attrs.resizerRight).css({
                    left: (x + parseInt($attrs.resizerWidth)) + 'px'
                });

            } else {
                // Handle horizontal resizer
                var y = window.innerHeight - event.pageY;

                $element.css({
                    bottom: y + 'px'
                });

                $($attrs.resizerTop).css({
                    bottom: (y + parseInt($attrs.resizerHeight)) + 'px'
                });
                $($attrs.resizerBottom).css({
                    height: y + 'px'
                });
            }
        }

        function mouseup(event) {
            
            if (event.pageX == clickX && event.pageY == clickY) {
                // Handle vertical resizer
                var x = event.pageX - $($attrs.resizerLeft).offset().left;

                console.log(x + " " + -$attrs.resizerWidth + " " + $attrs.resizerMax);
                
                if (x > $attrs.resizerWidth) {
                    x = -$attrs.resizerWidth;
                }
                else {
                    x = parseInt($attrs.resizerMax);
                }
            
                $element.css({
                    left: x + 'px'
                });
                $($attrs.resizerLeft).css({
                    width: x + 'px'
                });
                $($attrs.resizerRight).css({
                    left: (x + parseInt($attrs.resizerWidth)) + 'px'
                });
            }
            
            $document.off('mousemove', mousemove);
            $document.off('mouseup', mouseup);
        }
    };
});
