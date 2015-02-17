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
.controller('PaymentController',
['$scope', '$sce', '$location', '$routeParams', 'matrixService', 'dialogService',
function($scope, $sce, $location, $routeParams, matrixService, dialogService) {
	$scope.purchase = {
		user: matrixService.config().user_id,
		amount: 5.00,
		url: $sce.trustAsResourceUrl(webClientConfig.paymentUrl),
		submitted: false
	};

	if ($routeParams.payment_state) {
		$scope.status = {};
		// the user has been redirected back here after payment
		if ($routeParams.payment_state === "success") {
			$scope.status.title = "Success";
			$scope.status.description = "Your payment was processed successfully.";
		}
		else if ($routeParams.payment_state === "fail") {
			$scope.status.title = "Failed";
			$scope.status.description = "Your payment was not processed correctly.";
		}
		else if ($routeParams.payment_state === "cancel") {
			$scope.status.title = "Cancelled";
			$scope.status.description = "Your payment was cancelled.";
		}
		else {
			console.error("Unknown payment state");
			$location.url("/");
		}
	}

	$scope.onSubmit = function($event) {
		if($scope.purchase.amount <= 0) {
			dialogService.showError("Must have a positive amount.");
			$event.preventDefault();
			return;
		}
		// prevent multiple clicks
		if ($scope.purchase.submitted) {
			$event.preventDefault();
			return;
		}
		$scope.purchase.submitted = true;
	};

	$scope.onInit = function() {
		if (!$scope.purchase.url) {
			console.error("No configured payment URL!");
			$location.url("/");
		}
	};
}]);