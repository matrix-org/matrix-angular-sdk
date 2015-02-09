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

angular.module('PaymentController', [])
.controller('PaymentController', ['$scope', 'paymentService', 'dialogService',
function($scope, paymentService, dialogService) {
	$scope.payPal = {
		returnUrl: "http://localhost:8000",
		cancelUrl: "http://localhost:8001"
	};
	$scope.purchase = {
		amount: 19.95
	};

	$scope.onInit = function() {
		console.log("Loaded payment controller ");
	};

	$scope.payNow = function() {
		paymentService.setExpressCheckout($scope.purchase.amount).then(function(r) {
			console.log(r);
		},
		function(err) {
			dialogService.showError(err);
		});
	}

	// converts NVP to JSON
	var nvpToJson = function(nvp) {
		var pairs = nvp.split("&");
		var output = {};
		for (var i=0; i<pairs.length; i++) {
			var nv = pairs[i].split("=");
			output[nv[0]] = nv[1];
		}
		return output;
	};
}]);