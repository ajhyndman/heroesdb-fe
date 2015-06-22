
(function() {
	'use strict';

	var app = angular.module('heroesdb', ['ngResource', 'ngAnimate', 'ui.router']);

	run.$inject = ['$rootScope', '$location', '$window'];
	function run($rootScope, $location, $window) {
		//	$rootScope.$on('$stateChangeStart', function(event, toState, toParams, fromState, fromParams) { console.log('$stateChangeStart to ' + toState.name); });
		//	$rootScope.$on('$stateChangeError', function(event, toState, toParams, fromState, fromParams) { console.log('$stateChangeError'); });
		//	$rootScope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams) { console.log('$stateChangeSuccess to ' + toState.name); });
		//	$rootScope.$on('$viewContentLoaded', function(event) { console.log('$viewContentLoaded'); });
		//	$rootScope.$on('$stateNotFound', function(event, unfoundState, fromState, fromParams) { console.log('$stateNotFound ' + unfoundState.to); });
		$rootScope.$on('$stateChangeSuccess', function(event) {
			if (!$window.ga) {
				return;
			}
			$window.ga('send', 'pageview', { page: $location.path() });
		});
	}
	app.run(run);


	config.$inject = ['$compileProvider', '$stateProvider', '$locationProvider', '$urlRouterProvider', '$httpProvider'];
	function config($compileProvider, $stateProvider, $locationProvider, $urlRouterProvider, $httpProvider) {
		$compileProvider.debugInfoEnabled(false);
		$httpProvider.interceptors.push('VersionInterceptor');
		$httpProvider.interceptors.push('LoadingStatusInterceptor');
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
	}
	app.config(config);


	app.factory('VersionInterceptor', VersionInterceptorService);
	app.factory('LoadingStatusInterceptor', LoadingStatusInterceptorService);

	app.factory('Characters', CharactersService);
	app.factory('Classification', ClassificationService);
	app.factory('ObjectList', ObjectListService);
	app.factory('QualityType', QualityTypeService);
	app.factory('EnhanceType', EnhanceTypeService);
	app.factory('Object', ObjectService);
	app.factory('ObjectProperties', ObjectPropertiesService);
	app.factory('ObjectHovercard', ObjectHovercardService);

	app.directive('objectsTableMenu', objectsTableMenuDirective);
	app.directive('characterRestriction', characterRestrictionDirective);
	app.directive('objectHovercard', objectHovercardDirective);
	app.directive('enhanceSelector', enhanceSelectorDirective);

	app.controller('ItemsController', ItemsController);
	app.controller('ObjectsTableMenuController', ObjectsTableMenuController);
	app.controller('ObjectsTableController', ObjectsTableController);
	app.controller('ObjectCardController', ObjectCardController);


	VersionInterceptorService.$inject = ['$q'];
	function VersionInterceptorService($q) {
		var self = this;
		self.request = request;

		function request(config) {
			config.url += '?v=' + version;
			return config || $q.when(config);
		}

		return { request: self.request }
	}

	LoadingStatusInterceptorService.$inject = ['$rootScope', '$q'];
	function LoadingStatusInterceptorService($rootScope, $q) {
		var self = this;
		self.activeRequests = 0;
		self.request = request;
		self.response = response;
		self.responseError = responseError;

		$rootScope.loading = false;

		function request(config) {
			self.activeRequests += 1;
			$rootScope.loading = true;
			return config || $q.when(config);
		}

		function response(response) {
			self.activeRequests -= 1;
			if (self.activeRequests == 0) {
				$rootScope.loading = false;
			}
			return response || $q.when(response);
		}

		function responseError(rejection) {
			self.activeRequests -= 1;
			if (self.activeRequests == 0) {
				$rootScope.loading = false;
			}
			return $q.reject(rejection);
		}

		return {
			request: self.request,
			response: self.response,
			responseError: self.responseError
		}
	}

	CharactersService.$inject = ['$q', '$resource'];
	function CharactersService($q, $resource) {
		function Character(data, initial) {
			var self = this;
			self.id = data.id;
			self.name = data.name;
			self.initial = initial;
			self.description = data.description;
		}

		var self = this;
		self.resource = $resource('/data/characters.json');
		self.defer = null;
		self.characters = null;
		self.get = get;

		function get() {
			if (self.defer != null) {
				return self.defer.promise;
			}
			self.defer = $q.defer();
			if (self.characters != null) {
				self.defer.resolve(self.characters);
			}
			else {
				self.resource.query().$promise.then(function (characters) {
					var characterInitials = {};
					var characterInitialLength = {};
					var initialCharacters = {};
					for (var i = 0; i < characters.length; i += 1) {
						var character = characters[i];
						var initialLength = characterInitialLength[character.id] || 1;
						var initial = character.name.substring(0, initialLength);
						if (!(initial in initialCharacters)) {
							characterInitials[character.id] = initial;
							initialCharacters[initial] = character.id;
						}
						else {
							characterInitialLength[character.id] = initialLength + 1;
							characterInitialLength[initialCharacters[initial]] = initialLength + 1;
							characterInitials = {};
							initialCharacters = {};
							i = -1;
						}
					}
					self.characters = [];
					characters.forEach(function (character) {
						var initial = characterInitials[character.id];
						self.characters.push(new Character(character, initial));
					});
					self.defer.resolve(self.characters);
				});
			}
			return self.defer.promise;
		}

		return { get: self.get };
	}

	ClassificationService.$inject = ['$resource'];
	function ClassificationService($resource) {
		var self = this;
		self.resource = $resource('/data/classification.json');
		self.classification = null;
		self.get = get;
		
		function get() {
			if (self.classification == null) {
				self.classification = self.resource.get();
			}
			return self.classification;
		}

		return { get: self.get };
	}

	ObjectListService.$inject = ['$resource'];
	function ObjectListService($resource) {
		var self = this;
		self.resource = $resource('/data/objects/:key.json', { key: '@key' });
		self.objectLists = {};
		self.get = get;

		function get(categoryKey, typeKey) {
			var key = categoryKey;
			if (typeKey != null) {
				key += '-' + typeKey;
			}
			if (!(key in self.objectLists)) {
				self.objectLists[key] = self.resource.query({ key: key });
			}
			return self.objectLists[key];
		}

		return { get: self.get };
	}

	QualityTypeService.$inject = ['$resource'];
	function QualityTypeService($resource) {
		var self = this;
		self.resource = $resource('/data/quality-types/:key.json', { key: '@key' });
		self.qualityTypes = {};
		self.get = get;

		function get(key) {
			if (!(key in self.qualityTypes)) {
				self.qualityTypes[key] = self.resource.get({ key: key });
			}
			return self.qualityTypes[key];
		}

		return { get: self.get };
	}

	EnhanceTypeService.$inject = ['$resource'];
	function EnhanceTypeService($resource) {
		var self = this;
		self.resource = $resource('/data/enhance-types/:key.json', { key: '@key' });
		self.enhanceTypes = {};
		self.get = get;

		function get(key) {
			if (!(key in self.enhanceTypes)) {
				self.enhanceTypes[key] = self.resource.get({ key: key });
			}
			return self.enhanceTypes[key];
		}

		return { get: self.get };
	}

	ObjectService.$inject = ['$q', '$resource', 'ObjectProperties', 'Characters', 'QualityType', 'EnhanceType', 'ObjectList'];
	function ObjectService($q, $resource, ObjectProperties, Characters, QualityType, EnhanceType, ObjectList) {
		function Mat(data) {
			var self = this;
			self.type = 'mat';
			self.key = data.key;
			self.iconKey = data.iconKey || null;
			self.name = data.name;
			self.baseName = data.name;
			self.classification = data.classification;
			self.description = data.description || null;
			self.rarity = data.rarity || null;
		}

		function Equip(data, Object) {
			Mat.apply(this, arguments);
			var self = this;
			self.defer = $q.defer();
			self.type = 'equip';
			self.properties = {};
			self.propertyKeys = [];
			self.basePropertyKeys = [];
			self.updatePropertyKeys = updatePropertyKeys;
			self.setUpgrades = setUpgrades;
			self.quality = 2;
			self.qualityTypeKey = data.qualityTypeKey || null;
			self.qualityType = null;
			self.setQuality = setQuality;
			self.enhance = null;
			self.enhanceTypeKey = data.enhanceTypeKey || null;
			self.enhanceType = null;
			self.setEnhance = setEnhance;
			self.set = data.set;
			self.prefixEnchant = null;
			self.suffixEnchant = null;
			self.toggleEnchant = toggleEnchant;
			self.enchants = null;
			self.requiredSkills = data.requiredSkills;
			self.requiredLevel = data.requiredLevel;
			self.classRestriction = [];
			self.recipes = data.recipes || null;
			self.screenshots = data.screenshots || [];
			self.getScreenshotCharacterIndex = getScreenshotCharacterIndex;
			self.loadScreenshot = loadScreenshot;

			var promises = [];
			ObjectProperties.get().forEach(function(property) {
				var value = (property.key in data) ? data[property.key] : 0;
				self.properties[property.key] = {
					key: property.key,
					shortName: property.shortName,
					value: value,
					baseValue: value
				};
				if (property.base == true && value != 0) {
					self.propertyKeys.push(property.key);
					self.basePropertyKeys.push(property.key);
				}
			});

			var charactersPromise = Characters.get();
			promises.push(charactersPromise);
			charactersPromise.then(function(characters) {
				characters.forEach(function(character) {
					if ((data.classRestriction & character.id) == character.id) {
						self.classRestriction.push(character.name);
					}
				});
				if (self.classRestriction.length == characters.length) {
					self.classRestriction = [];
				}
			});

			if (self.enhanceTypeKey != null) {
				var enhanceTypePromise = EnhanceType.get(self.enhanceTypeKey).$promise;
				promises.push(enhanceTypePromise);
				enhanceTypePromise.then(function(enhanceType) {
					self.enhanceType = enhanceType;
				});
			}

			var enchantPromise = ObjectList.get('enchants').$promise;
			promises.push(enchantPromise);
			enchantPromise.then(function(enchants) {
				var permittedEnchants = [];
				enchants.forEach(function(enchant) {
					enchant.restrictions.forEach(function(restriction) {
						var permitted = true;
						permitted &= restriction[0] == null || data.groupKey == restriction[0];
						permitted &= restriction[1] == null || data.typeKey == restriction[1];
						permitted &= restriction[2] == null || data.categoryKeys.indexOf(restriction[2]) != -1;
						permitted &= restriction[3] == null || data.key == restriction[3];
						if (permitted) {
							permittedEnchants.push(enchant.key);
						}
					});
				});
				if (permittedEnchants.length > 0) {
					self.enchants = {
						prefix: [],
						suffix: []
					};
					enchants.forEach(function(enchant) {
						if (permittedEnchants.indexOf(enchant.key) >= 0) {
							if (enchant.prefix) {
								self.enchants.prefix.push(enchant);
							}
							else {
								self.enchants.suffix.push(enchant);
							}
						}
					});
				}
			});

			$q.all(promises).then(function() {
				self.defer.resolve(self);
			});

			function updatePropertyKeys() {
				self.propertyKeys = [];
				ObjectProperties.get().forEach(function(property) {
					if (property.base == true && self.properties[property.key].value != 0) {
						self.propertyKeys.push(property.key);
					}
				});
			}

			function setUpgrades(qualityLevel, enhanceLevel, prefixEnchantKey, suffixEnchantKey) {
				var defer = $q.defer();
				var promises = [];
				if (qualityLevel != null && qualityLevel != 2) {
					promises.push(QualityType.get(self.qualityTypeKey).$promise);
				}
				if (enhanceLevel != null) {
					promises.push(EnhanceType.get(self.enhanceTypeKey).$promise);
				}
				if (prefixEnchantKey != null) {
					promises.push(Object.get('enchant', prefixEnchantKey));
				}
				if (suffixEnchantKey != null) {
					promises.push(Object.get('enchant', suffixEnchantKey));
				}
				$q.all(promises).then(function(data) {
					ObjectProperties.get().forEach(function(property) {
						var key = property.key;
						self.properties[key].value = self.properties[key].baseValue;
					});
					var nameParts = [];
					if (qualityLevel != null && qualityLevel != 2) {
						self.qualityType = data.shift();
						ObjectProperties.get().forEach(function(property) {
							var key = property.key;
							if (key in self.qualityType[qualityLevel]) {
								self.properties[key].value = Math.floor(self.properties[key].value * (1 + self.qualityType[qualityLevel][key]));
							}
						});
					}
					self.quality = qualityLevel || 2;

					if (enhanceLevel != null) {
						self.enhanceType = data.shift();
						ObjectProperties.get().forEach(function(property) {
							var key = property.key;
							if (key in self.enhanceType[enhanceLevel]) {
								if (key == 'weight') {
									self.properties[key].value = Math.floor(self.properties[key].value * (1 + self.enhanceType[enhanceLevel][key]));
								}
								else {
									self.properties[key].value += self.enhanceType[enhanceLevel][key];
								}
							}
						});
						nameParts.push('+' + enhanceLevel);
					}
					self.enhance = enhanceLevel;

					function setEnchant(enchant) {
						enchant.propertyKeys.forEach(function(set) {
							set.keys.forEach(function(key) {
								var property = enchant.properties[set.condition][key];
								if (property.value != null) {
									self.properties[key].value += property.value;
								}
							});
						});
						nameParts.push(enchant.name);
					}
					if (prefixEnchantKey == null) {
						self.prefixEnchant = null;
					} else {
						self.prefixEnchant = data.shift();
						setEnchant(self.prefixEnchant);
					}
					if (suffixEnchantKey == null) {
						self.suffixEnchant = null;
					}
					else {
						self.suffixEnchant = data.shift();
						setEnchant(self.suffixEnchant);
					}

					self.updatePropertyKeys();
					nameParts.push(self.baseName);
					self.name = nameParts.join(' ');
					defer.resolve();
				});
				return defer.promise;
			}

			function setQuality(level) {
				var prefixEnchant = self.prefixEnchant ? self.prefixEnchant.key : null;
				var suffixEnchant = self.suffixEnchant ? self.suffixEnchant.key : null;
				return self.setUpgrades(level, self.enhance, prefixEnchant, suffixEnchant);
			}

			function setEnhance(level) {
				var prefixEnchant = self.prefixEnchant ? self.prefixEnchant.key : null;
				var suffixEnchant = self.suffixEnchant ? self.suffixEnchant.key : null;
				return self.setUpgrades(self.quality, level, prefixEnchant, suffixEnchant);
			}

			function toggleEnchant(prefix, key) {
				var prefixEnchant = prefix ? (self.prefixEnchant && self.prefixEnchant.key == key ? null : key) : (self.prefixEnchant ? self.prefixEnchant.key : null);
				var suffixEnchant = !prefix ? (self.suffixEnchant && self.suffixEnchant.key == key ? null : key) : (self.suffixEnchant ? self.suffixEnchant.key : null);
				return self.setUpgrades(self.quality, self.enhance, prefixEnchant, suffixEnchant);
			}

			function getScreenshotCharacterIndex(state) {
				var requiredCharacter = null;
				if (state.groupKey == 'armor' && state.typeKey == 'set' && 'categoryKey' in state) {
					var categories = { 'lann': 1, 'fiona': 2, 'evie': 4, 'karok': 8, 'kai': 16, 'vella': 32, 'hurk': 64, 'lynn': 128, 'arisha': 256 };
					requiredCharacter = categories[state.categoryKey];
				}
				else if (state.groupKey == 'weapon' && state.typeKey == 'all' && 'categoryKey' in state) {
					var categories = { 'dualsword': 1, 'dualspear': 1, 'longsword': 2, 'hammer': 2, 'staff': 4, 'scythe': 4, 'pillar': 8, 'blaster': 8, 'bow': 16, 'crossgun': 16, 'dualblade': 32, 'greatsword': 64, 'battleglaive': 128, 'longblade': 256 };
					requiredCharacter = categories[state.categoryKey];
				}
				if (requiredCharacter != null) {
					for (var i = 0; i < self.screenshots.length; i += 1) {
						var screenshot = self.screenshots[i];
						var character = screenshot.substr(screenshot.lastIndexOf('_') + 1, screenshot.length - screenshot.lastIndexOf('_') - 12);
						if (parseInt(character) == requiredCharacter) {
							return i;
						}
					}
				}
				return 0;
			}

			function loadScreenshot(index) {
				var defer = $q.defer();
				var img = new Image();
				img.src = '/data/screenshots/' + self.type + 's/' + self.screenshots[index];
				img.onload = function() {
					defer.resolve(img.src);
				};
				return defer.promise;
			}
		}
		Equip.prototype = Mat.prototype;
		Equip.prototype.constructior = Equip;

		function Set(data, Object) {
			Equip.apply(this, arguments);
			var self = this;
			self.type = 'set';
			self.updateProperties = updateProperties;
			self.updateRecipes = updateRecipes;
			self.setUpgrades = setUpgrades;
			self.setQuality = setQuality;
			self.setEnhance = setEnhance;
			self.partsInitialized = false;
			self.parts = [];
			self.loadParts = loadParts;
			self.enabledParts = [];
			self.partIsEnabled = partIsEnabled;
			self.togglePart = togglePart;
			self.effects = data.effects;
			self.activeEffectKey = activeEffectKey;

			function updateProperties() {
				var newValues = {};
				self.parts.forEach(function (part) {
					if (self.partIsEnabled(part.key) == true) {
						ObjectProperties.get().forEach(function (property) {
							var key = property.key;
							newValues[key] = (newValues[key] || 0) + part.properties[key].value;
						});
					}
				});
				if (self.activeEffectKey() in self.effects) {
					var effect = self.effects[self.activeEffectKey()];
					for (var key in effect) {
						newValues[key] = (newValues[key] || 0) + effect[key];
					}
				}
				ObjectProperties.get().forEach(function (property) {
					var key = property.key;
					self.properties[key].value = newValues[key] || 0;
				});
				self.updatePropertyKeys();
			}

			function updateRecipes() {
				var newNpcRecipe = { appearQuestNames: [], shops: [], mats: [] };
				var newPcRecipe = { expertises: [], mats: [] };
				var collectMats = function(recipeType) {
					var newMats = [];
					self.parts.forEach(function(part) {
						if (part.recipes != null && recipeType in part.recipes && self.partIsEnabled(part.key) == true) {
							part.recipes[recipeType].mats.forEach(function(mat) {
								var matAdded = false;
								for (var i = 0; i < newMats.length; i += 1) {
									if (newMats[i].key == mat.key) {
										matAdded = true;
										newMats[i].count += mat.count;
										break;
									}
								}
								if (matAdded == false) {
									newMats.push({
										key: mat.key,
										iconKey: mat.iconKey,
										name: mat.name,
										rarity: mat.rarity,
										order: mat.order,
										count: mat.count
									});
								}
							});
						}
					});
					newMats = newMats.sort(function(matA, matB) {
						if (matA.order > matB.order) return 1;
						if (matA.order < matB.order) return -1;
						if (matA.rarity > matB.rarity) return -1;
						if (matA.rarity < matB.rarity) return 1;
						if (matA.name > matB.name) return 1;
						if (matA.name < matB.name) return -1;
						return 0;
					});
					return newMats;
				};
				self.parts.forEach(function (part) {
					if (self.partIsEnabled(part.key) == true && part.recipes != null) {
						if ('npc' in part.recipes) {
							var recipe = part.recipes.npc;
							recipe.appearQuestNames.forEach(function(appearQuestName) {
								if (newNpcRecipe.appearQuestNames.indexOf(appearQuestName) == -1) {
									newNpcRecipe.appearQuestNames.push(appearQuestName);
								}
							});
							recipe.shops.forEach(function (shop) {
								var shopAdded = false;
								for (var i = 0; i < newNpcRecipe.shops.length; i += 1) {
									if (newNpcRecipe.shops[i].name == shop.name) {
										shopAdded = true;
										break;
									}
								}
								if (shopAdded == false) {
									newNpcRecipe.shops.push({
										key: shop.key,
										name: shop.name
									});
								}
							});
							newNpcRecipe.mats = collectMats('npc');
						}
						if ('pc' in part.recipes) {
							var recipe = part.recipes.pc;
							recipe.expertises.forEach(function (expertise) {
								var expertiseAdded = false;
								for (var i = 0; i < newPcRecipe.expertises.length; i += 1) {
									if (newPcRecipe.expertises[i].name == expertise.name) {
										expertiseAdded = true;
										if (newPcRecipe.expertises[i].experienceRequired < expertise.experienceRequired) {
											newPcRecipe.expertises[i].experienceRequired = expertise.experienceRequired;
										}
										break;
									}
								}
								if (expertiseAdded == false) {
									newPcRecipe.expertises.push({
										name: expertise.name,
										experienceRequired: expertise.experienceRequired
									});
								}
							});
							newPcRecipe.mats = collectMats('pc');
						}
					}
				});
				if (newNpcRecipe.mats.length + newPcRecipe.mats.length == 0) {
					self.recipes = null;
				}
				else {
					self.recipes = {};
					if (newNpcRecipe.mats.length > 0) {
						self.recipes.npc = newNpcRecipe;
					}
					if (newPcRecipe.mats.length > 0) {
						self.recipes.pc = newPcRecipe;
					}
				}
			}

			function setUpgrades(qualityLevel, enhanceLevel) {
				var defer = $q.defer();
				var promises = [];
				self.parts.forEach(function(part) {
					promises.push(part.setUpgrades(qualityLevel, enhanceLevel, null, null));
				});
				$q.all(promises).then(function() {
					self.updateProperties();
					self.quality = qualityLevel || 2;
					self.enhance = enhanceLevel;
					defer.resolve();
				});
				return defer.promise;
			}

			function setQuality(level) {
				return self.setUpgrades(level, self.enhance);
			}

			function setEnhance(level) {
				return self.setUpgrades(self.quality, level);
			}

			function loadParts() {
				var defer = $q.defer();
				if (self.partsInitialized == true) {
					defer.resolve(self.parts);
				}
				else {
					var promises = [];
					var partOrder = [];
					data.parts.forEach(function(part) {
						if (part.base == true) {
							var promise = Object.get('equip', part.key);
							promises.push(promise);
							partOrder.push(part.key);
							promise.then(function(equip) {
								self.parts.push(equip);
								self.enabledParts.push(equip.key);
								if (equip.qualityTypeKey != null) {
									self.qualityTypeKey = 'set';
								}
								if (equip.enhanceTypeKey != null) {
									self.enhanceTypeKey = 'set';
								}
							});
						}
					});
					$q.all(promises).then(function() {
						self.parts = self.parts.sort(function(partA, partB) {
							if (partOrder[partA.key] > partOrder[partB.key]) return 1;
							if (partOrder[partA.key] < partOrder[partB.key]) return -1;
							return 0;
						});
						self.partsInitialized = true;
						self.updateRecipes();
						defer.resolve(self.parts);
					});
				}
				return defer.promise;
			}

			function partIsEnabled(key) {
				return self.enabledParts.indexOf(key) >= 0;
			}

			function togglePart(key) {
				var i = self.enabledParts.indexOf(key);
				if (i == -1) {
					self.enabledParts.push(key);
				}
				else {
					self.enabledParts.splice(i, 1);
				}
				self.updateProperties();
				self.updateRecipes();
			}

			function activeEffectKey() {
				return self.enabledParts.length;
			}
		}
		Set.prototype = Equip.prototype;
		Set.prototype.constructior = Set;

		function Enchant(data) {
			Mat.apply(this, arguments);
			var self = this;
			self.type = 'enchant';
			self.iconKey = 'enchant_scroll';
			self.classification = 'Enchant Scroll, Rank ' + data.rank + ' ' + (data.prefix ? 'Prefix' : 'Suffix');
			self.rarity = 2;
			self.properties = {};
			self.propertyKeys = [];
			self.prefix = data.prefix;
			self.rank = data.rank;
			self.restrictionsText = data.restrictionsText;
			self.minSuccessChance = data.minSuccessChance;
			self.maxSuccessChance = data.maxSuccessChance;
			self.breakChance = data.breakChance;

			var objectProperties = {};
			ObjectProperties.get().forEach(function(property) {
				objectProperties[property.key] = property;
			});
			var propertyConditions = {};
			data.properties.forEach(function(dataProperty) {
				var objectProperty = objectProperties[dataProperty.key] || null;
				var conditionKey = (dataProperty.condition || '').replace('.', ' for:');
				if (!(conditionKey in self.properties)) {
					self.properties[conditionKey] = {};
				}
				self.properties[conditionKey][dataProperty.key] = {
					key: dataProperty.key,
					shortName: objectProperty != null ? objectProperty.shortName : dataProperty.key,
					value: dataProperty.value,
				};
				if (dataProperty.value == null || (objectProperty.base == true && dataProperty.value != 0)) {
					if (!(conditionKey in propertyConditions)) {
						propertyConditions[conditionKey] = [];
						self.propertyKeys.push({
							condition: conditionKey,
							keys: propertyConditions[conditionKey]
						});
					}
					propertyConditions[conditionKey].push(dataProperty.key);
				}
			});
		}
		Enchant.prototype = Mat.prototype;
		Enchant.prototype.constructior = Enchant;

		var self = this;
		self.objects = {};
		self.resource = $resource('/data/objects/:type/:key.json', { type: '@type', key: '@key' });
		self.get = get;

		function get(type, key) {
			var defer = $q.defer();
			if (!(type in self.objects)) {
				self.objects[type] = {}
			}
			if (key in self.objects[type]) {
				defer.resolve(self.objects[type][key]);
			}
			else {
				self.resource.get({ type: type + 's', key: key }).$promise.then(function (data) {
					var object = null;
					if (type == 'mat') {
						object = new Mat(data);
					}
					else if (type == 'equip') {
						object = new Equip(data, self);
					}
					else if (type == 'set') {
						object = new Set(data, self);
					}
					else if (type == 'enchant') {
						object = new Enchant(data, self);
					}
					var finalize = function() {
						self.objects[type][key] = object;
						defer.resolve(self.objects[type][key]);
					};
					if ('defer' in object) {
						object.defer.promise.then(finalize);
					}
					else {
						finalize();
					}
				});
			}
			return defer.promise;
		}

		return { get: self.get };
	}

	ObjectPropertiesService.$inject = [];
	function ObjectPropertiesService() {
		var self = this;
		self.objectProperties = [
			{ key: 'atk', name: 'Attack', shortName: 'ATT', base: false },
			{ key: 'patk', name: 'Attack', shortName: 'ATT', base: true },
			{ key: 'matk', name: 'Magic Attack', shortName: 'M.ATT', base: true },
			{ key: 'aatk', name: 'Additional Damage', shortName: 'Additional Damage', base: true },
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
			{ key: 'durability', name: 'Durability', shortName: 'Durability', base: false },
			{ key: 'weight', name: 'Weight', shortName: 'Weight', base: true },
			{ key: 'requiredLevel', name: 'Required Level', shortName: 'Level', base: false },
			{ key: 'classRestriction', name: 'Character Restriction', shortName: 'Character', base: false }
		];
		self.get = get;
		
		function get() {
			return self.objectProperties;
		}

		return { get: self.get };
	}

	ObjectHovercardService.$inject = ['$document', '$rootScope', '$compile', '$timeout', 'Object'];
	function ObjectHovercardService($document, $rootScope, $compile, $timeout, Object) {
		var self = this;
		self.objectKeyType = null;
		self.visible = false;
		self.scope = $rootScope.$new(true);
		self.scope.visible = false;
		self.show = show;
		self.update = update;
		self.hide = hide;

		var body = $document.find('body');
		body.append('<div ng-include="\'/templates/object-hovercard.html\'"></div>');
		var element = body[0].lastChild;
		$compile(element)(self.scope);

		function show(objectKeyType, style) {
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
		}

		function update(style) {
			self.scope.style = style;
		}

		function hide() {
			self.visible = false;
			self.scope.visible = self.visible;
		}

		return {
			show: show,
			update: update,
			hide: hide
		};
	}


	function objectsTableMenuDirective() {
		return {
			restriction: 'E',
			templateUrl: '/templates/objects-table-menu.html',
			controller: 'ObjectsTableMenuController',
			controllerAs: 'menu'
		};
	}

	characterRestrictionDirective.$inject = ['Characters'];
	function characterRestrictionDirective(Characters) {
		return {
			restriction: 'E',
			templateUrl: '/templates/character-restriction.html',
			link: function(scope, element, attrs) {
				scope.characters = [];
				scope.enabledCharacters = true;
				scope.ready = false;
				Characters.get().then(function(characters) {
					var enabled = [];
					var disabled = [];
					var flags = Number(attrs.characters);
					characters.forEach(function(character) {
						var flag = Number(character.id);
						var character = { initial: character.initial, name: character.name };
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
	}

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
	}

	enhanceSelectorDirective.$inject = ['$timeout'];
	function enhanceSelectorDirective($timeout) {
		return {
			restrict: 'A',
			link: function(scope, element, attrs, controller) {
				angular.element(element).attr('draggable', 'true');
				element.bind('dragstart', function(event) {
					if (event.target.className.indexOf('enabled') >= 0) {
						event.dataTransfer.effectAllowed = 'move';
						event.dataTransfer.setData('text', '');
						scope.$apply(function() {
							scope.card.enhance.selector.position = event.target.className.indexOf('end') >= 0 ? 'end' : 'start';
						});
					}
				});
				element.bind("dragenter", function(event) {
					if ('dataset' in event.target && 'level' in event.target.dataset) {
						$timeout.cancel(scope.card.enhance.selector.delayedUpade);
						var targetLevel = parseInt(event.target.dataset.level);
						if (scope.card.enhance.selector.position == 'start') {
							if (scope.card.enhance.start != targetLevel) {
								scope.$apply(function() {
									scope.card.enhance.selector.delayedUpade = $timeout(function() {
										scope.card.setEnhanceStart(targetLevel);
									}, 25);
								});
							}
						}
						else {
							if (scope.card.enhance.end != targetLevel) {
								scope.$apply(function() {
									scope.card.enhance.selector.delayedUpade = $timeout(function() {
										scope.card.setEnhanceEnd(targetLevel);
									}, 25);
								});
							}
						}
					}
				});
				element.bind("dragover", function(event) {
					event.preventDefault();
				});
				element.bind("drop", function(event) {
					event.preventDefault();
				});
			}
		}
	}


	function ItemsController() {
	}

	ObjectsTableMenuController.$inject = ['Classification'];
	function ObjectsTableMenuController(Classification) {
		var self = this;
		self.classification = Classification.get();
	}

	ObjectsTableController.$inject = ['$scope', '$stateParams', '$location', '$q', 'ObjectProperties', 'Characters', 'classification', 'objectList'];
	function ObjectsTableController($scope, $stateParams, $location, $q, ObjectProperties, Characters, classification, objectList) {
		function Column(data, table) {
			function ColumnOption(key, name, column) {
				var self = this;
				self.key = key;
				self.name = name;
				self.column = column;
				self.enabled = false;
				self.test = null;
				self.toggle = toggle;

				var search = $location.search();
				if (self.column.key in search) {
					var enabledOptions = search[self.column.key].split(',');
					if (enabledOptions.indexOf(self.key) >= 0) {
						self.enabled = true;
					}
				}

				function toggle() {
					self.enabled = !this.enabled;
					self.column.saveMenu();
					self.column.table.filter(true);
				}
			}

			function ColumnBetweenOption(key, name, column, from, till) {
				ColumnOption.apply(this, arguments);
				var self = this;
				self.from = from;
				self.till = till;
				self.test = test;
				
				function test(value) {
					return value >= from && value < till;
				}
			}
			ColumnBetweenOption.prototype = ColumnOption.prototype;
			ColumnBetweenOption.prototype.constructior = ColumnBetweenOption;

			function ColumnFlagOption(key, name, column, flag) {
				ColumnOption.apply(this, arguments);
				var self = this;
				self.flag = flag;
				self.test = test;
				
				function test(value) {
					return (value & self.flag) == self.flag;
				}
			}
			ColumnFlagOption.prototype = ColumnOption.prototype;
			ColumnFlagOption.prototype.constructior = ColumnFlagOption;

			var self = this;
			self.defer = $q.defer();
			self.key = data.key;
			self.name = data.name;
			self.shortName = data.shortName;
			self.table = table;
			self.optionsInitialized = false;
			self.optionEnabled = false;
			self.options = [];
			self.menuOpen = false;
			self.buildMenu = buildMenu;
			self.showMenu = showMenu;
			self.hideMenu = hideMenu;
			self.saveMenu = saveMenu;

			var search = $location.search();
			if (self.key in search) {
				self.buildMenu().then(function() {
					self.defer.resolve(self);
				});
			}
			else {
				self.defer.resolve(self);
			}

			function showMenu(column) {
				if (self.optionsInitialized) {
					self.menuOpen = true;
				}
				else {
					self.buildMenu().then(function() {
						self.optionsInitialized = true;
						self.menuOpen = true;
					});
				}
			}

			function hideMenu() {
				self.menuOpen = false;
			}

			function buildMenu() {
				var defer = $q.defer();
				self.options = [];
				var min = null;
				var max = null;
				var sum = 0;
				var count = 0;
				self.table.objectList.forEach(function(object) {
					if (self.key in object) {
						var value = object[self.key];
						if (max == null || max < value) {
							max = value;
						}
						if (min == null || min > value) {
							min = value;
						}
						count += 1;
						sum += value;
					}
				});
				var avg = Math.round(sum / count);

				if (self.key == 'requiredLevel') {
					for (var level = max; level >= 60; level -= 10) {
						var from = level - level % 10;
						var till = from + 10;
						var name = String(level)[0] + 'X';
						var key = name.toLowerCase();
						var option = new ColumnBetweenOption(key, name, self, from, till);
						self.options.push(option);
					}
					var option = new ColumnBetweenOption('low', 'Low-level', self, 0, 60);
					self.options.push(option);
					defer.resolve(self);
				}
				else if (self.key == 'classRestriction') {
					Characters.get().then(function(characters) {
						characters.forEach(function (character) {
							var option = new ColumnFlagOption(character.name.toLowerCase(), character.name, self, character.id);
							self.options.push(option);
						});
						defer.resolve(self);
					});
				}
				else if (min != 0 || max != 0) {
					var high = Math.round(max - ((max - avg) / 2));
					var low = Math.round(min + ((avg - min) / 2));
					var name = 'High (' + max + ' - ' + high + ')';
					var option = new ColumnBetweenOption('high', name, self, high, max + 1);
					self.options.push(option);
					if (high - 1 >= low) {
						var name = 'Average (' + (high - 1) + ' - ' + low + ')';
						var option = new ColumnBetweenOption('average', name, self, low, high);
						self.options.push(option);
					}
					if (low - 1 >= min) {
						var name = 'Low (' + (low - 1) + ' - ' + min + ')';
						var option = new ColumnBetweenOption('low', name, self, min, low);
						self.options.push(option);
					}
					defer.resolve(self);
				}
				else {
					defer.resolve(null);
				}

				return defer.promise;
			}

			function saveMenu() {
				var filter = null;
				self.options.forEach(function(option) {
					if (option.enabled == true) {
						if (filter == null) {
							filter = option.key;
						}
						else {
							filter += ',' + option.key;
						}
					}
				});
				$location.search(self.key, filter);
			}
		}

		var self = this;
		self.initialized = false;
		self.classification = classification;
		self.objectProperties = ObjectProperties.get();
		self.columns = [];
		self.objectList = [];
		self.objects = [];
		self.lastObjectIndex = 0;
		self.objectsToShow = 25;
		self.filter = filter;
		self.order = order;
		self.selectedObjectKey = null;
		self.selectObject = selectObject;
		self.orderColumnKey = null;
		self.orderReverse = false;

		objectList.forEach(function(object) {
			if ($stateParams.categoryKey == null || object.categoryKeys.indexOf($stateParams.categoryKey) >= 0) {
				self.objectList.push(object);
			}
		});

		var columnPromises = [];
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
			var column = new Column(property, self);
			columnPromises.push(column.defer.promise);
			self.columns.push(column);
		});

		var search = $location.search();
		if ('order' in search) {
			self.orderColumnKey = search.order.split('.')[0];
			self.orderReverse = search.order.split('.')[1] == 'asc' ? true : false;
			self.order();
		}
		$q.all(columnPromises).then(function() {
			self.filter(true);
			self.initialized = true;
		});

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

		function selectObject(key) {
			self.selectedObjectKey = self.selectedObjectKey == key ? null : key;
		}

		function filter(restart) {
			if (restart) {
				self.objects = [];
				self.lastObjectIndex = 0;
				self.objectsToShow = 25;
			}
			for (self.lastObjectIndex; self.lastObjectIndex < self.objectList.length && self.objects.length < self.objectsToShow; self.lastObjectIndex += 1) {
				var object = self.objectList[self.lastObjectIndex];
				var objectFiltered = true;
				self.columns.forEach(function(column) {
					column.optionEnabled = false;
					var columnFiltered = false;
					column.options.forEach(function(option) {
						if (option.enabled == true) {
							column.optionEnabled = true;
							columnFiltered |= option.test(object[column.key]);
						}
					});
					objectFiltered &= !column.optionEnabled || columnFiltered;
				});
				if (objectFiltered) {
					self.objects.push(object);
				}
			}
		}

		function order(columnKey) {
			if (columnKey != undefined) {
				if (self.orderColumnKey == columnKey) {
					self.orderReverse = !self.orderReverse;
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
		}
	}

	ObjectCardController.$inject = ['$state', '$stateParams', '$scope', '$q', '$timeout', 'Object', 'ObjectProperties'];
	function ObjectCardController($state, $stateParams, $scope, $q, $timeout, Object, ObjectProperties) {
		var self = this;
		self.object = null;
		self.visible = false;
		self.hide = hide;
		self.setPartColumns = [];
		self.enhance = {
			start: null,
			end: null,
			mats: {},
			properties: [],
			selector: {}
		};
		self.limitEnchants = true;
		self.screenshot = {
			expanded: false,
			action: 'none',
			currIndex: 0,
			currSrc: null,
			prev: null,
			curr: null,
			next: null,
			lock: false,
			defer: null
		};
		self.setEnhanceInfo = setEnhanceInfo;
		self.setEnhanceStart = setEnhanceStart;
		self.setEnhanceEnd = setEnhanceEnd;
		self.openScreenshot = openScreenshot;

		Object.get($stateParams.objectType, $stateParams.objectKey).then(function(object) {
			self.object = object;
			$scope.object = self.object;
			var promises = [];
			var partsDefer = $q.defer();
			promises.push(partsDefer.promise);
			if (!('parts' in self.object) || self.object.partsInitialized == true) {
				partsDefer.resolve();
			}
			else {
				self.object.loadParts().then(function() {
					partsDefer.resolve();
				});
			}
			partsDefer.promise.then(function() {
				if ('parts' in self.object) {
					self.object.parts.forEach(function(part) {
						if (!self.object.partIsEnabled(part.key)) {
							self.object.togglePart(part.key);
						}
					});
					var columns = [];
					var defaultColumns = [ 'def', 'str', 'int', 'dex', 'will', 'hp' ];
					var effectColumns = [];
					for (var effectKey in self.object.effects) {
						var effect = self.object.effects[effectKey];
						for (var propertyKey in effect) {
							if (effectColumns.indexOf(propertyKey) == -1) {
								effectColumns.push(propertyKey);
							}
						}
					}
					defaultColumns.forEach(function(defaultColumn) {
						if (effectColumns.indexOf(defaultColumn) >= 0) {
							columns.push(defaultColumn);
						}
					});
					effectColumns.forEach(function(effectColumn) {
						if (columns.indexOf(effectColumn) == -1) {
							columns.push(effectColumn);
						}
					});
					for (var i = 0; i < defaultColumns.length && columns.length < 6; i += 1) {
						var defaultColumn = defaultColumns[i];
						if (columns.indexOf(defaultColumn) == -1 && self.object.properties[defaultColumn].baseValue != 0) {
							columns.push(defaultColumn);
						}
					}
					ObjectProperties.get().forEach(function(property) {
						if (columns.indexOf(property.key) >= 0) {
							self.setPartColumns.push(property);
						}
					});
				}
				self.object.setUpgrades(null, null, null, null);
			});
			var screenshotDefer = $q.defer();
			promises.push(screenshotDefer.promise);
			if (!('screenshots' in self.object && self.object.screenshots.length > 0)) {
				screenshotDefer.resolve();
			}
			else {
				self.screenshot.currIndex = self.object.getScreenshotCharacterIndex($stateParams);
				self.object.loadScreenshot(self.screenshot.currIndex).then(function(src) {
					self.screenshot.currSrc = src;
					self.screenshot.prev = src;
					self.screenshot.curr = src;
					self.screenshot.next = src;
					screenshotDefer.resolve();
				});
			}
			$q.all(promises).then(function() {
				self.visible = true;
			});
		});

		function hide() {
			self.visible = false;
			$state.go('^');
		}

		function setEnhanceInfo() {
			var probability = 0.9;
			var chance = 1.0;
			var enhanceType = self.object.enhanceType;
			self.enhance.mats = {};
			self.enhance.matKeys = [];
			for (var i = self.enhance.start; i <= self.enhance.end; i += 1) {
				chance *= enhanceType[i].chance;
				for (var key in enhanceType[i].mats) {
					if (enhanceType[i].mats[key] > 0) {
						var mat = enhanceType.mats[key];
						if (!(key in self.enhance.mats)) {
							self.enhance.mats[key] = {
								key: key,
								iconKey: mat.iconKey,
								name: mat.name,
								rarity: mat.rarity,
								order: mat.order,
								count: 0
							};
						}
						self.enhance.mats[key].count += enhanceType[i].mats[key];
					}
				}
			}
			self.enhance.properties = [];
			ObjectProperties.get().forEach(function(property) {
				var property = self.object.properties[property.key];
				if (property.key in enhanceType[self.enhance.end]) {
					var value = null;
					if (property.key == 'weight') {
						value = Math.floor(property.baseValue * enhanceType[self.enhance.end][property.key]);
					}
					else {
						value = enhanceType[self.enhance.end][property.key];
						if (self.enhance.start > 1 && property.key in enhanceType[self.enhance.start - 1]) {
							value -= enhanceType[self.enhance.start - 1][property.key];
						}
					}
					self.enhance.properties.push({
						key: property.key,
						shortName: property.shortName,
						value: value
					});
				}
			});
			self.enhance.chance = Math.round(chance * 10000) / 100;
			self.enhance.probability = probability * 100;
			self.enhance.tries = chance == 1 ? 1 : Math.floor(Math.log(1 - probability) / Math.log(1 - chance));
		}

		function setEnhanceStart(level) {
			if (self.enhance.end < level) {
				self.enhance.end = level;
				self.object.setEnhance(level);
			}
			self.enhance.start = level;
			self.setEnhanceInfo();
		}

		function setEnhanceEnd(level) {
			if (self.enhance.end == level) {
				self.enhance.start = null;
				self.enhance.end = null;
				self.object.setEnhance(null);
				return;
			}
			if (self.enhance.start == null) {
				self.enhance.start = 1;
			}
			else if (self.enhance.start > level) {
				self.enhance.start = level;
			}
			self.enhance.end = level;
			self.object.setEnhance(level);
			self.setEnhanceInfo();
		}

		function openScreenshot(direction) {
			if (self.screenshot.lock == true) {
				return;
			}
			self.screenshot.lock = true;
			self.screenshot.defer = $q.defer();
			self.screenshot.curr = self.screenshot.currSrc;
			self.screenshot.action = 'none';
			var check = function() {
				if (document.getElementById('screenshot-images').className == 'images none') {
					self.screenshot.defer.resolve();
				}
				else {
					$timeout(check, 50);
				}
			}
			$timeout(check, 10);
			self.screenshot.defer.promise.then(function() {
				var newCurrIndex = self.screenshot.currIndex + direction;
				if (direction < 0) {
					if (newCurrIndex < 0) {
						newCurrIndex = self.object.screenshots.length - 1;
					}
					self.screenshot.currIndex = newCurrIndex;
					self.object.loadScreenshot(newCurrIndex).then(function(src) {
						self.screenshot.currSrc = src;
						self.screenshot.prev = src;
						self.screenshot.action = 'go-prev';
						$timeout(function() { self.screenshot.lock = false; }, 1100);
					});
				}
				if (direction > 0) {
					if (newCurrIndex > self.object.screenshots.length - 1) {
						newCurrIndex = 0;
					}
					self.screenshot.currIndex = newCurrIndex;
					self.object.loadScreenshot(newCurrIndex).then(function(src) {
						self.screenshot.currSrc = src;
						self.screenshot.next = src;
						self.screenshot.action = 'go-next';
						$timeout(function() { self.screenshot.lock = false; }, 1100);
					});
				}
			});
		}
	}

})();

