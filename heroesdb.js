
(function() {
	'use strict';

	var app = angular.module('heroesdb', ['ngResource', 'ngAnimate', 'ui.router']);

	//app.run(['$rootScope', function($rootScope) {
	//	$rootScope.$on('$stateChangeStart', function(event, toState, toParams, fromState, fromParams) { console.log('$stateChangeStart to ' + toState.name); });
	//	$rootScope.$on('$stateChangeError', function(event, toState, toParams, fromState, fromParams) { console.log('$stateChangeError'); });
	//	$rootScope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams) { console.log('$stateChangeSuccess to ' + toState.name); });
	//	$rootScope.$on('$viewContentLoaded', function(event) { console.log('$viewContentLoaded'); });
	//	$rootScope.$on('$stateNotFound', function(event, unfoundState, fromState, fromParams) { console.log('$stateNotFound ' + unfoundState.to); });
	//}]);


	config.$inject = ['$stateProvider', '$locationProvider', '$urlRouterProvider', '$httpProvider'];
	function config($stateProvider, $locationProvider, $urlRouterProvider, $httpProvider) {
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
		$stateProvider.state('items.group-type-category', {
			url: '/{groupKey}/{typeKey}/{categoryKey}',
			templateUrl: '/templates/objects-table.html',
			controller: 'ObjectsTableController',
			controllerAs: 'table',
			resolve: objectsTableResolve
		});
		$httpProvider.interceptors.push('LoadingStatus');
	};
	app.config(config);


	app.factory('LoadingStatus', LoadingStatusService);
	app.factory('Characters', CharactersService);
	app.factory('Classification', ClassificationService);
	app.factory('ObjectList', ObjectListService);
	app.factory('Object', ObjectService);
	app.factory('ObjectProperties', ObjectPropertiesService);
	app.factory('ObjectHovercard', ObjectHovercardService);

	app.directive('objectsTableMenu', objectsTableMenuDirective);
	app.directive('characterRestriction', characterRestrictionDirective);
	app.directive('objectHovercard', objectHovercardDirective);

	app.controller('ItemsController', ItemsController);
	app.controller('ObjectsTableMenuController', ObjectsTableMenuController);
	app.controller('ObjectsTableController', ObjectsTableController);


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

	ObjectService.$inject = ['$resource'];
	function ObjectService($resource, $http) {
		var self = this;
		self.objects = {};
		self.get = function(type, key) {
			type = type + 's';
			if (!(type in self.objects)) {
				self.objects[type] = {}
			}
			if (!(key in self.objects[type])) {
				self.objects[type][key] = $resource('/data/objects/:type/:key.json', { type: '@type', key: '@key' }).get({ type: type, key: key });
			}
			return self.objects[type][key];
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

	ObjectHovercardService.$inject = ['$document', '$rootScope', '$compile', '$q', '$filter', '$timeout', 'Object', 'ObjectProperties', 'Characters'];
	function ObjectHovercardService($document, $rootScope, $compile, $q, $filter, $timeout, Object, ObjectProperties, Characters) {
		var self = this;
		self.objectTypeKey = null;
		self.visible = false;
		self.scope = $rootScope.$new(true);
		self.scope.visible = false;

		var body = $document.find('body');
		body.append('<div class="object-hovercard-container" ng-include="\'/templates/object-hovercard.html\'"></div>');
		var element = body[0].lastChild;
		$compile(element)(self.scope);

		var show = function(objectTypeKey, style) {
			self.objectTypeKey = objectTypeKey;
			self.visible = true;
			var query = $q.all([
				Object.get(objectTypeKey.split('.')[0], objectTypeKey.split('.')[1]).$promise,
				ObjectProperties.get(),
				Characters.get().$promise
			]);
			query.then(function(data) {
				if (self.objectTypeKey == objectTypeKey && self.visible) {
					var object = data[0];
					var objectProperties = data[1];
					var characters = data[2];
					self.scope.iconID = object.iconID;
					self.scope.rarity = object.rarity;
					self.scope.name = object.name;
					self.scope.description = object.description;
					self.scope.set = ('set' in object) ? object.set : null;
					self.scope.requiredLevel = object.requiredLevel;
					self.scope.requiredSkills = object.requiredSkills;
					self.scope.stats = [];
					for (var i = 0; i < objectProperties.length; i++) {
						var property = objectProperties[i];
						if (property.base == true && object[property.key] > 0) {
							self.scope.stats.push({ name: property.shortName, value: object[property.key] });
						}
					}
					self.scope.parts = ('parts' in object) ? object.parts : [];
					self.scope.effects = null;
					for (var partCount in object.effects) {
						var effects = {};
						for (var i = 0; i < objectProperties.length; i++) {
							var property = objectProperties[i];
							if (property.key in object.effects[partCount]) {
								effects[property.shortName] = object.effects[partCount][property.key];
							}
						}
						if (self.scope.effects == null) {
							self.scope.effects = {};
						}
						self.scope.effects[partCount] = effects;
					}
					self.scope.classRestriction = [];
					characters.forEach(function(character) {
						if ((object.classRestriction & character.id) == character.id) {
							self.scope.classRestriction.push(character.name);
						}
					});
					if (self.scope.classRestriction.length == characters.length) {
						self.scope.classRestriction = [];
					}
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
						var x = 0;
						var y = 0;
						if (!event) {
							var e = window.event;
						}
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
			if ($stateParams.categoryKey == null || object.categoryKeys.indexOf($stateParams.categoryKey) != -1) {
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
					if (enabledOptions.indexOf(option.key) != -1) {
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
				if (valueA < valueB) {
					return self.orderReverse ? -1 : 1;
				}
				else if (valueA > valueB) {
					return self.orderReverse ? 1 : -1;
				}
				if (objectA.name < objectB.name) {
					return -1;
				}
				else if (objectA.name > objectB.name) {
					return 1;
				}
				else {
					return 0;
				}
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

})();

