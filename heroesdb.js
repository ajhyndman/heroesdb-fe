
(function() {
	'use strict';

	var app = angular.module('heroesdb', ['ngResource', 'ngAnimate', 'ui.router'])

	config.$inject = ['$stateProvider', '$locationProvider', '$urlRouterProvider'];
	function config($stateProvider, $locationProvider, $urlRouterProvider) {
		$locationProvider.html5Mode({
			enabled: false,
			requireBase: false
		});
		$urlRouterProvider.otherwise("/items");
		$stateProvider.state('items', {
			url: '/items',
			templateUrl: '/templates/items.html',
			controller: 'ItemsController',
			controllerAs: 'items'
		});
		var itemsListResolve = {
			groups: ['ItemGroups', function(ItemGroups) { return ItemGroups.get().$promise; }],
			stats: ['ItemStats', function(ItemStats) { return ItemStats.get().$promise; }],
			items: ['TypeItems', '$stateParams', function(TypeItems, $stateParams) { return TypeItems.get(Number($stateParams.typeId)).$promise; }],
			characters: ['Characters', function(Characters) { return Characters.get().$promise; }]
		};
		$stateProvider.state('items.group-type', {
			url: '/{groupId:[0-9]}/{typeId:[0-9]+}',
			templateUrl: '/templates/items-list.html',
			controller: 'ItemsListController',
			controllerAs: 'itemsList',
			resolve: itemsListResolve
		});
		$stateProvider.state('items.group-type-category', {
			url: '/{groupId:[0-9]+}/{typeId:[0-9]+}/{categoryId:[0-9]+}',
			templateUrl: '/templates/items-list.html',
			controller: 'ItemsListController',
			controllerAs: 'itemsList',
			resolve: itemsListResolve
		});
	};
	app.config(config);


	app.factory('Characters', CharactersService);
	app.factory('ItemGroups', ItemGroupsService);
	app.factory('ItemStats', ItemStatsService);
	app.factory('TypeItems', TypeItemsService);
	app.factory('Item', ItemService);
	app.factory('ItemHovercard', ItemHovercardService);

	app.directive('itemsFilter', itemsFilterDirective);
	app.directive('characterRestriction', characterRestrictionDirective);
	app.directive('itemIcon', itemIconDirective);
	app.directive('itemHovercard', itemHovercardDirective);

	app.controller('ItemsController', ItemsController);
	app.controller('ItemsFilterController', ItemsFilterController);
	app.controller('ItemsListController', ItemsListController);


	CharactersService.$inject = ['$resource'];
	function CharactersService($resource) {
		var self = this;
		self.data;
		self.characterInitials;
		self.get = function() {
			if (!self.data) {
				self.data = $resource('/data/characters.json').query();
			}
			return self.data;
		};
		self.getInitials = function() {
			if (!self.characterInitials) {
				self.characterInitials = {};
				var characters = self.data;
				var characterInitialLength = {};
				var initialCharacters = {};
				var s = 0;
				for (var i = 0; i < characters.length; i++) {
					s++;
					if (s > 100) break;
					var character = characters[i];
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
					self.characterInitials[initialCharacters[initial]] = initial;
				}
			}
			return self.characterInitials;
		};
		return {
			get: self.get,
			getInitials: self.getInitials
		};
	};

	ItemGroupsService.$inject = ['$resource'];
	function ItemGroupsService($resource) {
		var self = this;
		self.data;
		self.get = function() {
			if (!self.data) {
				self.data = $resource('/data/item-groups.json').query();
			}
			return self.data;
		};
		return { get: self.get };
	};

	ItemStatsService.$inject = ['$resource'];
	function ItemStatsService($resource) {
		var self = this;
		self.data;
		self.get = function() {
			if (!self.data) {
				self.data = $resource('/data/item-stats.json').query();
			}
			return self.data;
		};
		return { get: self.get };
	};

	TypeItemsService.$inject = ['$resource'];
	function TypeItemsService($resource) {
		var self = this;
		self.data = {};
		self.get = function(typeId) {
			if (!self.data[typeId]) {
				self.data[typeId] = $resource('/data/type-items/:typeId.json', { typeId: '@typeId' }).query({ typeId: typeId });
			}
			return self.data[typeId];
		};
		return { get: self.get };
	};

	ItemService.$inject = ['$resource'];
	function ItemService($resource) {
		var self = this;
		self.data = {};
		self.get = function(itemId) {
			if (!self.data[itemId]) {
				self.data[itemId] = $resource('/data/items/:itemId.json', { itemId: '@itemId' }).get({ itemId: itemId });
			}
			return self.data[itemId];
		};
		return { get: self.get };
	};

	ItemHovercardService.$inject = ['$document', '$rootScope', '$compile', '$q', '$filter', '$timeout', 'Item', 'ItemStats', 'Characters'];
	function ItemHovercardService($document, $rootScope, $compile, $q, $filter, $timeout, Item, ItemStats, Characters) {
		var self = this;
		self.id = null;
		self.visible = false;
		self.scope = $rootScope.$new(true);
		self.scope.visible = false;

		var body = $document.find('body');
		body.append('<div class="item-hovercard-container" ng-include="\'/templates/item-hovercard.html\'"></div>');
		var element = body[0].lastChild;
		$compile(element)(self.scope);

		var show = function(itemId, style) {
			self.id = itemId;
			self.visible = true;
			var query = $q.all([
				Item.get(itemId).$promise,
				ItemStats.get().$promise,
				Characters.get().$promise
			]);
			query.then(function(data) {
				if (self.id == itemId && self.visible) {
					var item = data[0];
					var stats = data[1];
					var characters = data[2];
					self.scope.item = item;
					self.scope.itemStats = $filter('filter')(stats, function(stat) {
						var itemHasStat = item.stats[stat.id] || 0 > 0;
						var isGuiStat = stat.type == 'Base';
						return itemHasStat && isGuiStat;
					});
					self.itemStats = $filter('orderBy')(self.itemStats, 'order');
					var requiredLevelStat;
					var classRestrictionStat;
					for (var i = 0; i < stats.length; i++) {
						if (stats[i].type == 'RequiredLevel') {
							requiredLevelStat = stats[i].id;
						}
						else if (stats[i].type == 'ClassRestriction') {
							classRestrictionStat = stats[i].id;
						}
					}
					self.scope.item.requiredLevel = item.stats[requiredLevelStat];
					var classRestriction = [];
					characters.forEach(function(character) {
						if ((Number(item.stats[classRestrictionStat]) & Number(character.id)) == Number(character.id)) {
							classRestriction.push(character.name);
						}
					});
					if (classRestriction.length == characters.length) {
						self.scope.item.classRestriction = [];
					}
					else {
						self.scope.item.classRestriction = classRestriction;
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


	function itemsFilterDirective() {
		return {
			restriction: 'E',
			templateUrl: '/templates/items-filter.html',
			controller: 'ItemsFilterController',
			controllerAs: 'itemsFilter'
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
						var flagSet = ((flags & flag) == flag);
						var data = { initial: initials[character.id], name: character.name };
						if (flagSet) {
							enabled.push(data);
						}
						else {
							disabled.push(data);
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

	function itemIconDirective() {
		return {
			restriction: 'E',
			templateUrl: '/templates/item-icon.html',
			scope: { iconId: '@' },
			link: function(scope, element, attrs) {
				scope.iconId = attrs.iconId;
				element.find('img').bind('error', function () {
					angular.element(this).attr('src', '/data/icons/0.png');
				});
			}
		};
	};

	itemHovercardDirective.$inject = ['$document', '$timeout', 'ItemHovercard'];
	function itemHovercardDirective($document, $timeout, ItemHovercard) {
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
						var element = document.getElementById('item-hovercard');
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
							ItemHovercard.show(attrs.itemHovercard, calculatePosition);
						});
					}, 250);
				});
				element.bind('mouseleave', function(event) {
					if (delayedShow) {
						$timeout.cancel(delayedShow);
					}
					scope.$apply(function() {
						ItemHovercard.hide();
					});
				});
			}
		};
	};


	function ItemsController() {
	};

	ItemsFilterController.$inject = ['$resource'];
	function ItemsFilterController($resource) {
		var self = this;
		var url = '/data/item-groups.json';
		self.groups = $resource(url, {}, { cache: true }).query();
	};

	ItemsListController.$inject = ['$scope', '$stateParams', '$filter', '$timeout', 'groups', 'stats', 'items', 'characters'];
	function ItemsListController($scope, $stateParams, $filter, $timeout, groups, stats, items, characters) {
		var self = this;
		self.groups = groups;
		self.stats = stats;
		self.characters = characters;
		self.columns = [];
		self.typeItems = items;
		self.categoryItems = [];
		self.items = [];
		self.itemsShown = 0;
		self.itemsToShow = 25;
		self.selectedItem = null;
		self.selectItem = selectItem;
		self.order = order;
		self.orderColumn = null;
		self.orderReverse = false;
		self.filters = {};
		self.filter = filter;
		self.showFilter = showFilter;
		self.hideFilters = hideFilters;
		self.hideFiltersDelays = {};

		var getById = function(objects, id) {
			var result;
			for (var i = 0; i < objects.length; i += 1) {
				if (objects[i].id == id) {
					result = objects[i];
					break;
				}
			}
			return result;
		};
		var group = getById(self.groups, $stateParams.groupId);
		var type = getById(group.types, $stateParams.typeId);
		var primaryStats = type.primaryStats;
		primaryStats.forEach(function(stat) {
			var stat = getById(self.stats, stat);
			stat.filters = null;
			self.columns.push(stat);
		});

		for (var i = 0; i < self.typeItems.length; i++) {
			var item = self.typeItems[i];
			if (item.groupId == $stateParams.groupId) {
				if (item.typeId == $stateParams.typeId) {
					if ($stateParams.categoryId == null || item.categoryId.indexOf(Number($stateParams.categoryId)) != -1) {
						self.categoryItems.push(item);
					}
				}
			}
		}

		function order(column) {
			if (self.orderColumn == column) {
				self.orderReverse = self.orderReverse ? false : true;
			}
			else {
				self.orderReverse = false;
			}
			self.orderColumn = String(column);
			self.itemsShown = 0;
			self.itemsToShow = 25;
			self.categoryItems = self.categoryItems.sort(function(itemA, itemB) {
				var valueA = null;
				var valueB = null;
				if (Object.keys(itemA).indexOf(self.orderColumn) > -1) {
					valueA = itemA[self.orderColumn];
				}
				else if (Object.keys(itemA.stats).indexOf(self.orderColumn) > -1) {
					valueA = itemA.stats[self.orderColumn];
				}
				if (Object.keys(itemB).indexOf(self.orderColumn) > -1) {
					valueB = itemB[self.orderColumn];
				}
				else if (Object.keys(itemB.stats).indexOf(self.orderColumn) > -1) {
					valueB = itemB.stats[self.orderColumn];
				}
				if (valueA < valueB) {
					return self.orderReverse ? -1 : 1;
				}
				else if (valueA > valueB) {
					return self.orderReverse ? 1 : -1;
				}
				if (itemA.name < itemB.name) {
					return -1;
				}
				else if (itemA.name > itemB.name) {
					return 1;
				}
				else {
					return 0;
				}
			});
			self.filter();
		};

		function filter() {
			self.items = [];
			for (var i = self.itemsShown; i < self.categoryItems.length && self.items.length < self.itemsToShow; i++) {
				var item = self.categoryItems[i];
				var itemFiltered = true;
				for (var statId in self.filters) {
					var itemStatFiltersActive = false;
					var itemStatFiltered = false;
					for (var testKey in self.filters[statId]) {
						if (self.filters[statId][testKey]) {
							itemStatFiltersActive = true;
							itemStatFiltered |= self.filters[statId][testKey](item.stats[statId]);
						}
					}
					itemFiltered &= (!itemStatFiltersActive || itemStatFiltered);
				}
				if (itemFiltered) {
					self.items.push(item);
				}
			}
		};

		function selectItem(index) {
			self.selectedItem = self.selectedItem == index ? null : index;
		};

		function hideFilters() {
			for (var i = 0; i < self.columns.length; i++) {
				if (self.columns[i].filterOpen) {
					self.columns[i].filterOpen = false;
				}
			}
		};

		function showFilter(statId) {
			var column = getById(self.columns, statId);
			if (!column.filters) {
				column.filters = [];
				self.filters[statId] = {};
				var min = null;
				var max = null;
				var sum = 0;
				var count = 0;
				for (var i = 0; i < self.categoryItems.length; i++) {
					var item = self.categoryItems[i];
					if (item.stats[statId] != undefined) {
						var value = item.stats[statId];
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

				var createFilter = function(name, from, till) {
					return {
						name: name,
						enabled: false,
						toggle: function() {
							var test = function(value) { return value >= from && value < till; };
							this.enabled = !this.enabled;
							self.filters[statId][this.name] = this.enabled ? test : null;
							self.itemsShown = 0;
							self.itemsToShow = 25;
							self.filter();
						}
					}
				};

				var createCharacterFilter = function(name, id) {
					return {
						name: name,
						enabled: false,
						toggle: function() {
							var test = function(value) { return (value & id) == id; };
							this.enabled = !this.enabled;
							self.filters[statId][this.name] = this.enabled ? test : null;
							self.itemsShown = 0;
							self.itemsToShow = 25;
							self.filter();
						}
					}
				};

				if (column.type == 'RequiredLevel') {
					for (var level = max; level >= 60; level -= 10) {
						var from = level - level % 10;
						var till = from + 10;
						column.filters.push(createFilter(String(level)[0] + 'X', from, till));
					}
					column.filters.push(createFilter('Low-level', 0, 60));
				}

				else if (column.type == 'ClassRestriction') {
					for (var i = 0; i < self.characters.length; i++) {
						var character = self.characters[i];
						column.filters.push(createCharacterFilter(character.name, character.id));
					}
				}

				else {
					var high = Math.round(max - ((max - avg) / 2));
					var low = Math.round(min + ((avg - min) / 2));
					if (max > 0) {
						var name = 'High (' + max + ' - ' + high + ')';
						column.filters.push(createFilter(name, high, max + 1));
					}
					if (high > 0) {
						var name = 'Average (' + (high - 1) + ' - ' + low + ')';
						column.filters.push(createFilter(name, low, high));
					}
					if (low > 0) {
						var name = 'Low (' + (low - 1) + ' - ' + min + ')';
						column.filters.push(createFilter(name, min, low));
					}
				}
			}
			column.filterOpen = true;
		};

		var content = document.getElementById('content');
		angular.element(content).bind('scroll', function() {
			if (content.scrollTop + content.offsetHeight + 200 >= content.scrollHeight) {
				$scope.$apply(function() {
					if (self.itemsToShow < self.categoryItems.length) {
						self.itemsToShow += 25;
						self.filter();
					}
				});
			}
		});
		self.filter();
	};

})();

