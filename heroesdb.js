
(function() {
	'use strict';

	var app = angular.module('heroesdb', ['ngResource', 'ngAnimate', 'ui.router']);

	app.run(['$rootScope', '$location', '$window', function($rootScope, $location, $window) {
		$rootScope.$on('$stateChangeSuccess', function(event) {
			if (!$window.ga) {
				return;
			}
			$window.ga('send', 'pageview', { page: $location.path() });
		});
	}]);

	//app.run(['$rootScope', function($rootScope) {
	//	$rootScope.$on('$stateChangeStart', function(event, toState, toParams, fromState, fromParams) { console.log('$stateChangeStart to ' + toState.name); });
	//	$rootScope.$on('$stateChangeError', function(event, toState, toParams, fromState, fromParams) { console.log('$stateChangeError'); });
	//	$rootScope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams) { console.log('$stateChangeSuccess to ' + toState.name); });
	//	$rootScope.$on('$viewContentLoaded', function(event) { console.log('$viewContentLoaded'); });
	//	$rootScope.$on('$stateNotFound', function(event, unfoundState, fromState, fromParams) { console.log('$stateNotFound ' + unfoundState.to); });
	//}]);


	config.$inject = ['$compileProvider', '$stateProvider', '$locationProvider', '$urlRouterProvider', '$httpProvider'];
	function config($compileProvider, $stateProvider, $locationProvider, $urlRouterProvider, $httpProvider) {
		$compileProvider.debugInfoEnabled(false);
		$locationProvider.html5Mode({
			enabled: true,
			requireBase: false
		});
		$urlRouterProvider.otherwise("/items");
		$stateProvider.state('items', {
			url: '/items',
			templateUrl: '/templates/items.html',
			controller: 'ItemsController',
			controllerAs: 'items'
		});
		var objectsTableResolve = {
			classification: ['Classification', function(Classification) { return Classification.get().$promise; }],
			objectList: ['ObjectList', '$stateParams', function(ObjectList, $stateParams) { return ObjectList.get($stateParams.groupKey, $stateParams.typeKey).$promise; }]
		};
		$stateProvider.state('items.group-type', {
			url: '/{groupKey}/{typeKey}',
			templateUrl: '/templates/objects-table.html',
			controller: 'ObjectsTableController',
			controllerAs: 'table',
			resolve: objectsTableResolve
		});
		$stateProvider.state('items.group-type.item', {
			url: '/{objectKey}.{objectType}',
			templateUrl: '/templates/object-card.html',
			controller: 'ObjectCardController',
			controllerAs: 'card',
		});
		$stateProvider.state('items.group-type-category', {
			url: '/{groupKey}/{typeKey}/{categoryKey}',
			templateUrl: '/templates/objects-table.html',
			controller: 'ObjectsTableController',
			controllerAs: 'table',
			resolve: objectsTableResolve
		});
		$stateProvider.state('items.group-type-category.item', {
			url: '/{objectKey}.{objectType}',
			templateUrl: '/templates/object-card.html',
			controller: 'ObjectCardController',
			controllerAs: 'card',
		});
		$httpProvider.interceptors.push('LoadingStatus');
	};
	app.config(config);


	app.factory('LoadingStatus', LoadingStatusService);
	app.factory('Characters', CharactersService);
	app.factory('Classification', ClassificationService);
	app.factory('ObjectList', ObjectListService);
	app.factory('QualityType', QualityTypeService);
	app.factory('Object', ObjectService);
	app.factory('ObjectProperties', ObjectPropertiesService);
	app.factory('ObjectHovercard', ObjectHovercardService);

	app.directive('objectsTableMenu', objectsTableMenuDirective);
	app.directive('characterRestriction', characterRestrictionDirective);
	app.directive('objectHovercard', objectHovercardDirective);

	app.controller('ItemsController', ItemsController);
	app.controller('ObjectsTableMenuController', ObjectsTableMenuController);
	app.controller('ObjectsTableController', ObjectsTableController);
	app.controller('ObjectCardController', ObjectCardController);


	LoadingStatusService.$inject = ['$rootScope', '$q'];
	function LoadingStatusService($rootScope, $q) {
		$rootScope.loading = false;
		var activeRequests = 0;
		return {
			request: function(config) {
				activeRequests += 1;
				$rootScope.loading = true;
				return config || $q.when(config);
			},
			response: function(response) {
				if ((activeRequests -= 1) == 0) {
					$rootScope.loading = false;
				}
				return response || $q.when(response);
			},
			responseError: function(rejection) {
				if ((activeRequests -= 1) == 0) {
					$rootScope.loading = false;
				}
				return $q.reject(rejection);
			}
		}
	};

	CharactersService.$inject = ['$resource'];
	function CharactersService($resource) {
		var self = this;
		self.characters = null;
		self.initials = null;
		self.get = function() {
			if (self.characters == null) {
				self.characters = $resource('/data/characters.json').query();
			}
			return self.characters;
		};
		self.getInitials = function() {
			if (self.initials == null) {
				self.initials = {};
				var characterInitialLength = {};
				var initialCharacters = {};
				var safety = 1;
				for (var i = 0; i < self.characters.length; i += 1) {
					if (safety++ > 1000) {
						break;
					}
					var character = self.characters[i];
					if (!(character.id in characterInitialLength)) {
						characterInitialLength[character.id] = 1;
					}
					var initialLength = characterInitialLength[character.id];
					var initial = character.name.substring(0, initialLength);
					if (initial in initialCharacters) {
						characterInitialLength[character.id] = initialLength + 1;
						characterInitialLength[initialCharacters[initial]] = initialLength + 1;
						initialCharacters = {};
						i = -1;
					}
					else {
						initialCharacters[initial] = character.id;
					}
				}
				for (var initial in initialCharacters) {
					self.initials[initialCharacters[initial]] = initial;
				}
			}
			return self.initials;
		};
		return {
			get: self.get,
			getInitials: self.getInitials
		};
	};

	ClassificationService.$inject = ['$resource'];
	function ClassificationService($resource) {
		var self = this;
		self.classification = null;
		self.get = function() {
			if (self.classification == null) {
				self.classification = $resource('/data/classification.json').get();
			}
			return self.classification;
		};
		return { get: self.get };
	};

	ObjectListService.$inject = ['$resource'];
	function ObjectListService($resource) {
		var self = this;
		self.objectLists = {};
		self.get = function(categoryKey, typeKey) {
			var key = categoryKey + '-' + typeKey;
			if (!(key in self.objectLists)) {
				self.objectLists[key] = $resource('/data/objects/:key.json', { key: '@key' }).query({ key: key });
			}
			return self.objectLists[key];
		};
		return { get: self.get };
	};

	QualityTypeService.$inject = ['$resource'];
	function QualityTypeService($resource) {
		var self = this;
		self.qualityTypes = {};
		self.get = function(key) {
			if (!(key in self.qualityTypes)) {
				self.qualityTypes[key] = $resource('/data/quality-types/:key.json', { key: '@key' }).get({ key: key });
			}
			return self.qualityTypes[key];
		};
		return { get: self.get };
	};

	ObjectService.$inject = ['$q', '$resource', 'ObjectProperties', 'Characters'];
	function ObjectService($q, $resource, ObjectProperties, Characters) {
		var self = this;
		self.objects = {};
		self.get = function(type, key) {
			var defer = $q.defer();
			type = type + 's';
			if (!(type in self.objects)) {
				self.objects[type] = {}
			}
			if (key in self.objects[type]) {
				defer.resolve(self.objects[type][key]);
			}
			else {
				var query = $q.all([
					$resource('/data/objects/:type/:key.json', { type: '@type', key: '@key' }).get({ type: type, key: key }).$promise,
					Characters.get().$promise
				]);
				query.then(function(data) {
					var defers = [];
					var rawObject = data[0];
					var characters = data[1];
					var objectProperties = ObjectProperties.get();
					var object = {};
					object.key = rawObject.key;
					object.iconID = rawObject.iconID;
					object.name = rawObject.name;
					object.classification = rawObject.classification;
					object.description = rawObject.description;
					object.rarity = rawObject.rarity;
					if (rawObject.qualityTypeKey) {
						object.qualityTypeKey = rawObject.qualityTypeKey;
					}
					if (rawObject.set) {
						object.set = rawObject.set;
					}
					object.requiredSkills = rawObject.requiredSkills;
					object.requiredLevel = rawObject.requiredLevel;
					object.classRestriction = [];
					characters.forEach(function(character) {
						if ((rawObject.classRestriction & character.id) == character.id) {
							object.classRestriction.push(character.name);
						}
					});
					if (object.classRestriction.length == characters.length) {
						object.classRestriction = [];
					}
					object.properties = [];
					for (var i = 0; i < objectProperties.length; i++) {
						var property = objectProperties[i];
						if (property.base == true && rawObject[property.key] > 0) {
							object[property.key] = rawObject[property.key];
							object.properties.push(property);
						}
					}
					if (rawObject.recipes) {
						object.recipes = rawObject.recipes;
					}
					if (rawObject.parts) {
						object.parts = [];
						for (var i = 0; i < rawObject.parts.length; i += 1) {
							var part = rawObject.parts[i];
							object.parts.push(part);
							if (part.key != null) {
								var partDefer = self.get('equip', part.key);
								defers.push(partDefer);
								partDefer.then(function (data) {
									for (var i = 0; i < object.parts.length; i += 1) {
										if (object.parts[i].key == data.key) {
											object.parts[i] = data;
											break;
										}
									}
								});
							}
						}
					}
					object.effects = ('effects' in rawObject) ? rawObject.effects : null;
					self.objects[type][key] = object;
					$q.all(defers).then(function () {
						defer.resolve(self.objects[type][key]);
					});
				});
			}
			return defer.promise;
		};
		return { get: self.get };
	};

	ObjectPropertiesService.$inject = [];
	function ObjectPropertiesService() {
		var self = this;
		self.objectProperties = [
			{ key: 'atk', name: 'Attack', shortName: 'ATT', base: false },
			{ key: 'patk', name: 'Attack', shortName: 'ATT', base: true },
			{ key: 'matk', name: 'Magic Attack', shortName: 'M.ATT', base: true },
			{ key: 'speed', name: 'Attack Speed', shortName: 'AS', base: true },
			{ key: 'crit', name: 'Critical Chance', shortName: 'CRIT', base: true },
			{ key: 'bal', name: 'Balance', shortName: 'BAL', base: true },
			{ key: 'def', name: 'Defence', shortName: 'DEF', base: true },
			{ key: 'str', name: 'Strength', shortName: 'STR', base: true },
			{ key: 'int', name: 'Intelligence', shortName: 'INT', base: true },
			{ key: 'dex', name: 'Agility', shortName: 'AGI', base: true },
			{ key: 'will', name: 'Willpower', shortName: 'WILL', base: true },
			{ key: 'hp', name: 'Health Points', shortName: 'HP', base: true },
			{ key: 'critres', name: 'Critical Resistance', shortName: 'CRITRES', base: true },
			{ key: 'stamina', name: 'Stamina', shortName: 'Stamina', base: true },
			{ key: 'requiredLevel', name: 'Required Level', shortName: 'Level', base: false },
			{ key: 'classRestriction', name: 'Character Restriction', shortName: 'Character', base: false }
		];
		self.get = function() {
			return self.objectProperties;
		};
		return { get: self.get };
	};

	ObjectHovercardService.$inject = ['$document', '$rootScope', '$compile', '$timeout', 'Object'];
	function ObjectHovercardService($document, $rootScope, $compile, $timeout, Object) {
		var self = this;
		self.objectKeyType = null;
		self.visible = false;
		self.scope = $rootScope.$new(true);
		self.scope.visible = false;

		var body = $document.find('body');
		body.append('<div ng-include="\'/templates/object-hovercard.html\'"></div>');
		var element = body[0].lastChild;
		$compile(element)(self.scope);

		var show = function(objectKeyType, style) {
			self.objectKeyType = objectKeyType;
			self.visible = true;
			Object.get(objectKeyType.split('.')[1], objectKeyType.split('.')[0]).then(function(data) {
				if (self.objectKeyType == objectKeyType && self.visible) {
					self.scope.object = data;
					$timeout(function() {
						self.scope.style = style();
						self.scope.visible = self.visible;
					}, 1);
				}
			});
		};

		var update = function(style) {
			self.scope.style = style;
		};

		var hide = function() {
			self.visible = false;
			self.scope.visible = self.visible;
		};

		return {
			show: show,
			update: update,
			hide: hide
		};
	};


	function objectsTableMenuDirective() {
		return {
			restriction: 'E',
			templateUrl: '/templates/objects-table-menu.html',
			controller: 'ObjectsTableMenuController',
			controllerAs: 'menu'
		};
	};

	characterRestrictionDirective.$inject = ['Characters'];
	function characterRestrictionDirective(Characters) {
		return {
			restriction: 'E',
			templateUrl: '/templates/character-restriction.html',
			link: function(scope, element, attrs) {
				scope.characters = [];
				scope.enabledCharacters = true;
				scope.ready = false;
				Characters.get().$promise.then(function(characters) {
					var enabled = [];
					var disabled = [];
					var initials = Characters.getInitials();
					var flags = Number(attrs.characters);
					characters.forEach(function(character) {
						var flag = Number(character.id);
						var character = { initial: initials[character.id], name: character.name };
						if ((flags & flag) == flag) {
							enabled.push(character);
						}
						else {
							disabled.push(character);
						}
					});
					if (disabled.length > 0) {
						if (enabled.length <= disabled.length + 1) {
							scope.characters = enabled;
							scope.enabledCharacters = true;
						}
						else {
							scope.characters = disabled;
							scope.enabledCharacters = false;
						}
					}
					scope.ready = true;
				});
			}
		};
	};

	objectHovercardDirective.$inject = ['$document', '$timeout', 'ObjectHovercard'];
	function objectHovercardDirective($document, $timeout, ObjectHovercard) {
		return {
			restriction: 'A',
			link: function(scope, element, attrs) {
				var delayedShow;
				var currentMousePosition;
				var calculatePosition = function() {
					var getDocumentSize = function() {
						var x = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
						var y = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
						return { x: x, y: y };
					};
					var getPointerPosition = function(event) {
						if (!event) {
							return { x: 50, y: 50 };
						}
						var x = 0;
						var y = 0;
						if (event.pageX || event.pageY) {
							x = event.pageX;
							y = event.pageY;
						}
						else if (event.clientX || event.clientY) {
							x = event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
							y = event.clientY + document.body.scrollTop + document.documentElement.scrollTop;
						}
						return { x: x, y: y };
					};
					var getHovercardSize = function() {
						var element = document.getElementById('object-hovercard');
						var x = element.offsetWidth;
						var y = element.offsetHeight;
						return { x: x, y: y };
					};
					var style = {};
					var doc = getDocumentSize();
					var pointer = getPointerPosition(currentMousePosition);
					var hovercard = getHovercardSize();
					style.left = (pointer.x + 20) + 'px';
					var fitsDown = doc.y >= pointer.y + hovercard.y + 20;
					var fitsUp = doc.y >= hovercard.y - 20;
					if (!fitsDown && fitsUp) {
						style.top = (pointer.y - hovercard.y - 20) + 'px';
					}
					else {
						style.top = (pointer.y + 20) + 'px'
					}
					return style;
				};
				$document.bind('mousemove', function(event) {
					currentMousePosition = event;
				});
				element.bind('mouseenter', function(event) {
					delayedShow = $timeout(function() {
						scope.$apply(function() {
							ObjectHovercard.show(attrs.objectHovercard, calculatePosition);
						});
					}, 250);
				});
				element.bind('mouseleave', function(event) {
					if (delayedShow) {
						$timeout.cancel(delayedShow);
					}
					scope.$apply(function() {
						ObjectHovercard.hide();
					});
				});
			}
		};
	};



	function ItemsController() {
	};

	ObjectsTableMenuController.$inject = ['Classification'];
	function ObjectsTableMenuController(Classification) {
		var self = this;
		self.classification = Classification.get();
	};

	ObjectsTableController.$inject = ['$scope', '$stateParams', '$location', '$q', 'ObjectProperties', 'Characters', 'classification', 'objectList'];
	function ObjectsTableController($scope, $stateParams, $location, $q, ObjectProperties, Characters, classification, objectList) {
		var self = this;
		self.classification = classification;
		self.objectProperties = ObjectProperties.get();
		self.columns = [];
		self.objectList = [];
		self.objects = [];
		self.lastObjectIndex = 0;
		self.objectsToShow = 25;
		self.filter = filter;
		self.selectedObjectKey = null;
		self.selectObject = selectObject;
		self.orderColumnKey = null;
		self.orderReverse = false;
		self.order = order;
		self.showColumnMenu = showColumnMenu;
		self.hideColumnMenu = hideColumnMenu;

		var findWithKey = function(objects, key) {
			for (var i = 0; i < objects.length; i += 1) {
				if (objects[i].key == key) {
					return objects[i];
				}
			}
		};
		var group = findWithKey(self.classification.groups, $stateParams.groupKey);
		var type = findWithKey(group.types, $stateParams.typeKey);
		type.primaryProperties.forEach(function(property) {
			var property = findWithKey(self.objectProperties, property);
			delete property.options;
			self.columns.push(property);
		});

		for (var i = 0; i < objectList.length; i += 1) {
			var object = objectList[i];
			if ($stateParams.categoryKey == null || object.categoryKeys.indexOf($stateParams.categoryKey) >= 0) {
				self.objectList.push(object);
			}
		}

		var content = document.getElementById('content');
		angular.element(content).bind('scroll', function() {
			if (content.scrollTop + content.offsetHeight + 200 >= content.scrollHeight) {
				$scope.$apply(function() {
					if (self.lastObjectIndex < self.objectList.length) {
						self.objectsToShow += 25;
						self.filter(false);
					}
				});
			}
		});

		var filterDefers = [];
		var search = $location.search();
		for (var ci = 0; ci < self.columns.length; ci += 1) {
			var column = self.columns[ci];
			if (column.key in search) {
				filterDefers.push(buildColumnMenu(column));
			}
		}
		$q.all(filterDefers).then(function(columns) {
			for (var i = 0; i < columns.length; i += 1) {
				var column = columns[i];
				var enabledOptions = search[column.key].split(',');
				for (var oi = 0; oi < column.options.length; oi += 1) {
					var option = column.options[oi];
					if (enabledOptions.indexOf(option.key) >= 0) {
						option.enabled = true;
					}
				}
			}
			if ('order' in search) {
				self.orderColumnKey = search.order.split('.')[0];
				self.orderReverse = search.order.split('.')[1] == 'asc' ? true : false;
				self.order();
			}
			self.filter(true);
		});

		function selectObject(key) {
			self.selectedObjectKey = self.selectedObjectKey == key ? null : key;
		};

		function filter(restart) {
			if (restart) {
				self.objects = [];
				self.lastObjectIndex = -1;
				self.objectsToShow = 25;
			}
			for (self.lastObjectIndex += 1; self.lastObjectIndex < self.objectList.length && self.objects.length < self.objectsToShow; self.lastObjectIndex += 1) {
				var object = self.objectList[self.lastObjectIndex];
				var objectFiltered = true;
				for (var ci = 0; ci < self.columns.length; ci += 1) {
					var column = self.columns[ci];
					column.optionEnabled = false;
					var columnFiltered = false;
					if ('options' in column) {
						for (var oi = 0; oi < column.options.length; oi += 1) {
							var option = column.options[oi];
							if (option.enabled == true) {
								column.optionEnabled = true;
								columnFiltered |= option.test(object[column.key]);
							}
						}
					}
					objectFiltered &= !column.optionEnabled || columnFiltered;
				}
				if (objectFiltered) {
					self.objects.push(object);
				}
			}
		};

		function order(columnKey) {
			if (columnKey != undefined) {
				if (self.orderColumnKey == columnKey) {
					self.orderReverse = self.orderReverse ? false : true;
				}
				else {
					self.orderReverse = false;
				}
				self.orderColumnKey = columnKey;
				$location.search('order', self.orderColumnKey + (self.orderReverse ? '.asc' : '.desc'));
			}
			self.objectList = self.objectList.sort(function(objectA, objectB) {
				var valueA = null;
				var valueB = null;
				if (self.orderColumnKey in objectA && self.orderColumnKey in objectB) {
					valueA = objectA[self.orderColumnKey];
					valueB = objectB[self.orderColumnKey];
				}
				if (valueA < valueB) return self.orderReverse ? -1 : 1;
				if (valueA > valueB) return self.orderReverse ? 1 : -1;
				if (objectA.name < objectB.name) return -1;
				if (objectA.name > objectB.name) return 1;
				return 0;
			});
			if (columnKey != undefined) {
				self.filter(true);
			}
		};

		function buildColumnMenu(column) {
			var defer = $q.defer();
			column.options = [];
			var min = null;
			var max = null;
			var sum = 0;
			var count = 0;
			for (var i = 0; i < self.objectList.length; i += 1) {
				var object = self.objectList[i];
				if (column.key in object) {
					var value = object[column.key];
					if (max == null || max < value) {
						max = value;
					}
					if (min == null || min > value) {
						min = value;
					}
					count += 1;
					sum += value;
				}
			}
			var avg = Math.round(sum / count);

			var saveOptions = function() {
				var filter = '';
				for (var ci = 0; ci < self.columns.length; ci += 1) {
					var column = self.columns[ci];
					if ('options' in column) {
						var filter = '';
						for (var oi = 0; oi < column.options.length; oi += 1) {
							var option = column.options[oi];
							if (option.enabled == true) {
								filter += (filter.length == 0 ? '' : ',');
								filter += option.key;
							}
						}
						if (filter.length > 0) {
							$location.search(column.key, filter);
						}
						else {
							$location.search(column.key, null);
						}
					}
				}
			};

			var createOption = function(key, name, from, till) {
				return {
					key: key,
					name: name,
					enabled: false,
					test: function(value) { return value >= from && value < till; },
					toggle: function() {
						this.enabled = !this.enabled;
						saveOptions();
						self.filter(true);
					}
				}
			};

			var createCharacterOption = function(key, name, id) {
				return {
					key: key,
					name: name,
					enabled: false,
					test: function(value) { return (value & id) == id; },
					toggle: function() {
						this.enabled = !this.enabled;
						saveOptions();
						self.filter(true);
					}
				}
			};

			if (column.key == 'requiredLevel') {
				for (var level = max; level >= 60; level -= 10) {
					var from = level - level % 10;
					var till = from + 10;
					var name = String(level)[0] + 'X';
					var key = name.toLowerCase();
					column.options.push(createOption(key, name, from, till));
				}
				column.options.push(createOption('low', 'Low-level', 0, 60));
				defer.resolve(column);
			}

			else if (column.key == 'classRestriction') {
				Characters.get().$promise.then(function(characters) {
					for (var i = 0; i < characters.length; i += 1) {
						var character = characters[i];
						column.options.push(createCharacterOption(character.name.toLowerCase(), character.name, character.id));
					}
					defer.resolve(column);
				});
			}

			else {
				var high = Math.round(max - ((max - avg) / 2));
				var low = Math.round(min + ((avg - min) / 2));
				if (max > 0) {
					var name = 'High (' + max + ' - ' + high + ')';
					column.options.push(createOption('high', name, high, max + 1));
				}
				if (high > 0) {
					var name = 'Average (' + (high - 1) + ' - ' + low + ')';
					column.options.push(createOption('average', name, low, high));
				}
				if (low > 0) {
					var name = 'Low (' + (low - 1) + ' - ' + min + ')';
					column.options.push(createOption('low', name, min, low));
				}
				defer.resolve(column);
			}
			return defer.promise;
		};

		function hideColumnMenu() {
			for (var i = 0; i < self.columns.length; i += 1) {
				if (self.columns[i].menuOpen) {
					self.columns[i].menuOpen = false;
				}
			}
		};

		function showColumnMenu(column) {
			if ('options' in column) {
				column.menuOpen = true;
			}
			else {
				buildColumnMenu(column).then(function() {
					column.menuOpen = true;
				});
			}
		};
	};

	ObjectCardController.$inject = ['$state', '$stateParams', '$scope', '$q', 'Object', 'QualityType'];
	function ObjectCardController($state, $stateParams, $scope, $q, Object, QualityType) {
		var self = this;
		self.hide = hide;
		self.visible = false;
		self.setSetPartColumns = setSetPartColumns;
		self.updateSetProperties = updateSetProperties;
		self.updateSetRecipe = updateSetRecipe;
		self.setQuality = setQuality;
		self.selectedSetParts = [];
		self.toggleSetPart = toggleSetPart;
		self.setPartIsSelected = setPartIsSelected;
		self.activeSetEffectKey = activeSetEffectKey;

		Object.get($stateParams.objectType, $stateParams.objectKey).then(function(data) {
			$scope.object = data;
			if ('quality' in $scope.object) {
				self.setQuality(2);
			}
			else if ('qualityTypeKey' in $scope.object) {
				$scope.object.quality = 2;
			}
			else if ('parts' in $scope.object) {
				for (var i = 0; i < $scope.object.parts.length; i += 1) {
					if ('qualityTypeKey' in $scope.object.parts[i]) {
						$scope.object.quality = 2;
						break;
					}
				}
			}
			if ('parts' in $scope.object) {
				for (var pi = 0; pi < $scope.object.parts.length; pi += 1) {
					var equip = $scope.object.parts[pi];
					self.selectedSetParts.push(equip.key);
				}
				self.setSetPartColumns();
				self.updateSetRecipe();
			}
			self.visible = true;
		});

		function setSetPartColumns() {
			var columns = [];
			var defaultColumns = [ 'def', 'str', 'int', 'dex', 'will', 'hp' ];
			var effectColumns = [];
			for (var effectKey in $scope.object.effects) {
				var effect = $scope.object.effects[effectKey];
				for (var propertyKey in effect) {
					if (effectColumns.indexOf(propertyKey) == -1) {
						effectColumns.push(propertyKey);
					}
				}
			}
			for (var i = 0; i < defaultColumns.length; i += 1) {
				if (effectColumns.indexOf(defaultColumns[i]) >= 0) {
					columns.push(defaultColumns[i]);
				}
			}
			for (var i = 0; i < effectColumns.length; i += 1) {
				if (columns.indexOf(effectColumns[i]) == -1) {
					columns.push(effectColumns[i]);
				}
			}
			for (var i = 0; i < defaultColumns.length && columns.length < 6; i += 1) {
				if (columns.indexOf(defaultColumns[i]) == -1 && (defaultColumns[i] in $scope.object)) {
					columns.push(defaultColumns[i]);
				}
			}
			$scope.columns = [];
			for (var ci = 0; ci < columns.length; ci += 1) {
				var column = columns[ci];
				for (var pi = 0; pi < $scope.object.properties.length; pi += 1) {
					var property = $scope.object.properties[pi];
					if (property.key == column) {
						$scope.columns.push(property);
						break;
					}
				}
			}
		};

		function updateSetProperties() {
			var properties = {};
			for (var pi = 0; pi < $scope.object.parts.length; pi += 1) {
				var equip = $scope.object.parts[pi];
				for (var pri = 0; pri < $scope.object.properties.length; pri += 1) {
					var property = $scope.object.properties[pri];
					if (!(property.key in properties)) {
						properties[property.key] = 0;
					}
					if (property.key in equip && self.selectedSetParts.indexOf(equip.key) >= 0) {
						properties[property.key] += equip[property.key];
					}
				}
			}
			if (self.selectedSetParts.length in $scope.object.effects) {
				var activeEffect = $scope.object.effects[self.selectedSetParts.length];
				for (var propertyKey in activeEffect) {
					var propertyValue = activeEffect[propertyKey];
					if (!(propertyKey in properties)) {
						properties[propertyKey] = 0;
					}
					properties[propertyKey] += propertyValue;
				}
			}
			for (var propertyKey in properties) {
				$scope.object[propertyKey] = properties[propertyKey];
			}
		};

		function updateSetRecipe() {
			var recipes = {
				npc: {
					appearQuestNames: [],
					shops: []
				},
				pc: {
					expertises: []
				}
			};
			var npcRecipe = false;
			var pcRecipe = false;
			var getSetMats = function(recipeType, setParts) {
				var mats = [];
				for (var pi = 0; pi < setParts.length; pi += 1) {
					var equip = setParts[pi];
					if ('recipes' in equip && recipeType in equip.recipes && self.selectedSetParts.indexOf(equip.key) >= 0) {
						for (var mi = 0; mi < equip.recipes[recipeType].mats.length; mi += 1) {
							var mat = equip.recipes[recipeType].mats[mi];
							var added = false;
							for (var ami = 0; ami < mats.length; ami += 1) {
								var addedMat = mats[ami];
								if (addedMat.key == mat.key) {
									added = true;
									addedMat.count += mat.count;
									break;
								}
							}
							if (!added) {
								mats.push({
									key: mat.key,
									iconID: mat.iconID,
									name: mat.name,
									rarity: mat.rarity,
									order: mat.order,
									count: mat.count
								});
							}
						}
					}
				}
				mats = mats.sort(function(matA, matB) {
					if (matA.order > matB.order) return 1;
					if (matA.order < matB.order) return -1;
					if (matA.rarity > matB.rarity) return -1;
					if (matA.rarity < matB.rarity) return 1;
					if (matA.name > matB.name) return 1;
					if (matA.name < matB.name) return -1;
					return 0;
				});
				return mats;
			};
			for (var pi = 0; pi < $scope.object.parts.length; pi += 1) {
				var equip = $scope.object.parts[pi];
				if (self.selectedSetParts.indexOf(equip.key) == -1) {
					continue;
				}
				if (equip.recipes != null && 'npc' in equip.recipes) {
					npcRecipe = true;
					if ('appearQuestName' in equip.recipes.npc) {
						if (recipes.npc.appearQuestNames.indexOf(equip.recipes.npc.appearQuestName) == -1) {
							recipes.npc.appearQuestNames.push(equip.recipes.npc.appearQuestName);
						}
					}
					for (var si = 0; si < equip.recipes.npc.shops.length; si += 1) {
						var shop = equip.recipes.npc.shops[si];
						var added = false;
						for (var asi = 0; asi < recipes.npc.shops.length; asi += 1) {
							var addedShop = recipes.npc.shops[asi];
							if (addedShop.key == shop.key) {
								added = true;
								break;
							}
						}
						if (!added) {
							recipes.npc.shops.push(shop);
						}
					}
				}
				if (equip.recipes && 'pc' in equip.recipes) {
					pcRecipe = true;
					var added = false;
					for (var i = 0; i < recipes.pc.expertises.length; i += 1) {
						var addedExpertise = recipes.pc.expertises[i];
						if (addedExpertise.name == equip.recipes.pc.expertiseName) {
							added = true;
							if (addedExpertise.experienceRequired < equip.recipes.pc.expertiseExperienceRequired) {
								addedExpertise.experienceRequired = equip.recipes.pc.expertiseExperienceRequired;
							}
							break;
						}
					}
					if (!added) {
						recipes.pc.expertises.push({
							name: equip.recipes.pc.expertiseName,
							experienceRequired: equip.recipes.pc.expertiseExperienceRequired
						});
					}
				}
			}
			if (npcRecipe || pcRecipe) {
				$scope.object.recipes = {};
				var totalMats = 0;
				if (npcRecipe) {
					recipes.npc.mats = getSetMats('npc', $scope.object.parts);
					totalMats += recipes.npc.mats.length;
					$scope.object.recipes.npc = recipes.npc;
				}
				if (pcRecipe) {
					recipes.pc.mats = getSetMats('pc', $scope.object.parts);
					totalMats += recipes.pc.mats.length;
					$scope.object.recipes.pc = recipes.pc;
				}
				if (totalMats == 0) {
					$scope.object.recipes = null;
				}
			}
			else {
				$scope.object.recipes = null;
			}
		};

		function hide() {
			self.visible = false;
			$state.go('^');
		};

		function setQuality(quality) {
			var setEquipQuality = function(equip, quality) {
				var defer = QualityType.get(equip.qualityTypeKey).$promise;
				defer.then(function (qualityType) {
					for (var i = 0; i < equip.properties.length; i += 1) {
						var property = equip.properties[i];
						if (!(quality in qualityType)) {
							if ((property.key + 'Base') in equip) {
								equip[property.key] = equip[property.key + 'Base'];
							}
						}
						else if (property.key in qualityType[quality]) {
							if (!((property.key + 'Base') in equip)) {
								equip[property.key + 'Base'] = equip[property.key];
							}
							equip[property.key] = Math.floor(equip[property.key + 'Base'] * (1 + qualityType[quality][property.key]));
						}
					}
					equip.quality = quality;
				});
				return defer;
			};
			if ('qualityTypeKey' in $scope.object) {
				setEquipQuality($scope.object, quality);
			}
			else if ('parts' in $scope.object) {
				var defers = [];
				for (var i = 0; i < $scope.object.parts.length; i += 1) {
					var equip = $scope.object.parts[i];
					if ('qualityTypeKey' in equip) {
						defers.push(setEquipQuality(equip, quality));
						$scope.object.quality = quality;
					}
				}
				$q.all(defers).then(function() {
					self.updateSetProperties();
				});
			}
		};

		function toggleSetPart(key) {
			var i = self.selectedSetParts.indexOf(key);
			if (i == -1) {
				self.selectedSetParts.push(key);
			}
			else {
				self.selectedSetParts.splice(i, 1);
			}
			self.updateSetProperties();
			self.updateSetRecipe();
		};

		function setPartIsSelected(key) {
			return self.selectedSetParts.indexOf(key) >= 0;
		};

		function activeSetEffectKey() {
			return self.selectedSetParts.length;
		};
	};

})();

