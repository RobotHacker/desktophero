function SceneModel(){
	this.userSettings = new UserSettings();
	this.libraries = new ObservableDict();
	this.libraries.put("default", new LocalDataSource("default", "/testlib"));
	this.character = new Character();
	this.materials = {};
}


SceneModel.prototype = {
	getAvailableMeshes: function(type){
		var allMeshes = [];
		for (var libraryName in this.libraries.dict){
			var library = this.libraries.get(libraryName);
			var meshes = library.getMeshes();
			for (var meshName in meshes){
				meshMetadata = meshes[meshName];
				if (meshMetadata.type === type){
					allMeshes.push(meshMetadata);
				}
			}
		}
		return allMeshes;
	},

	addMesh(boneGroupName, libraryName, meshName, material){
		var defaultMaterial = self.materials["default"];
		var boneGroup = this.character.boneGroups.get(boneGroupName);
		this.libraries.get(libraryName).fetchMesh(meshName, function(name, mesh){
			mesh.material = new THREE.MeshFaceMaterial([defaultMaterial]);
			boneGroup.addMesh(name, mesh);
		});
	},

	getAvailablePoses: function(){
		var allPoses = {};
		for (var libraryName in this.libraries.dict){
			allPoses[libraryName] = [];

			var library = this.libraries.get(libraryName);
			var poses = library.getPoses();
			for (var i = 0; i < poses.length(); i++){
				var pose = poses.get(i);
				allPoses[libraryName].push(pose);
			}
		}
		return allPoses;
	},

	getAvailableBoneGroups: function(){
		var allBoneGroups = {};
		for (var libraryName in this.libraries.dict){
			allBoneGroups[libraryName] = [];

			var library = this.libraries.get(libraryName);
			var boneGroups = library.getBoneGroups();
			for (var i = 0; i < boneGroups.length(); i++){
				var boneGroup = boneGroups.get(i);
				allBoneGroups[libraryName].push(boneGroup);
			}
		}
		return allBoneGroups;
	},

	addBoneGroup: function(libraryName, boneGroupName){
		// TODO: Change the name of the bone group if a bone group with
		// that name already exists on the character.
		self = this;
		self.libraries.get(libraryName).fetchBoneGroup(boneGroupName, function(name, boneGroup){
			self.character.addBoneGroup(name, boneGroup);
		});
	},

	getAvailableAttachPoints: function(){
		var allAttachPoints = {};
		var boneGroups = this.character.boneGroups;
		for (var boneGroupName in boneGroups.dict){
			allAttachPoints[boneGroupName] = [];
			var boneGroup = boneGroups.get(boneGroupName);
			for (var attachPointName in boneGroup.attachPoints){
				allAttachPoints[boneGroupName].push(attachPointName);
			}
		}
		return allAttachPoints;
	},

	attachBoneGroup: function(boneGroupName, toBoneGroupName, attachPointName){
		var boneGroup = this.character.boneGroups.get(boneGroupName);
		var attachBone = this.character.boneGroups.get(toBoneGroupName).attachPoints[attachPointName];
		boneGroup.attachToBone(toBoneGroupName, attachPointName, attachBone);
	},

	unattachBoneGroup: function(boneGroupName){
		var boneGroup = this.character.boneGroups.get(boneGroupName);
		boneGroup.unattach();
	},

	saveCurrentPose: function(poseName, library, author, type, tags){
		currentPose = this.character.getCurrentPose();
		jsonString = Pose.toJson(currentPose, poseName, library, author, type, tags);
		FileSaver.download(jsonString, poseName + ".txt");
	},

	loadPose: function(libraryName, poseName){
		var self = this;
		self.libraries.get(libraryName).fetchPose(poseName, function(poseJson){
			self.character.loadPose(poseJson);
		});
	},

	saveCharacter: function(){
		// Must save bone groups, meshes attached to bone groups, 
		// places meshes are attached, pos/rot/scale of bone groups, pose.

		var json = {
			character: this.character.toJSON(),
			pose: this.character.getCurrentPose()
		};

		FileSaver.download(JSON.stringify(json, null, " "), this.character.name + ".js");
	},

	initCharacter: function(){
		var self = this;
		
		var defaultDataSource = self.libraries.get('default');
		var boneGroupsLeftToBeLoaded = 6;

		for (var i = 0; i < SceneModel.boneGroupsToLoad.length; i++){
			var name = SceneModel.boneGroupsToLoad[i];

			defaultDataSource.fetchBoneGroup(name, function(boneGroupName, boneGroup){
				self.character.addBoneGroup(boneGroupName, boneGroup);
				boneGroupsLeftToBeLoaded -= 1;
				if (boneGroupsLeftToBeLoaded <= 0){
					self.initBoneGroupsAdded();
				}
			});
		}
	},

	initBoneGroupsAdded: function(){
		var self = this;

		var defaultDataSource = self.libraries.get('default');
		var meshesLeftToBeLoaded = 6;

		var defaultMaterial = self.materials["default"];
		// Attach meshes to bone groups.
		for (var i = 0; i < SceneModel.boneGroupsToLoad.length; i++){
			var name = SceneModel.boneGroupsToLoad[i];

			defaultDataSource.fetchMesh(name, function(name, mesh){
				var boneGroup = self.character.boneGroups.get(name);
				mesh.material = new THREE.MeshFaceMaterial([defaultMaterial]);
				boneGroup.addMesh(name, mesh);
				meshesLeftToBeLoaded -= 1;
				if (meshesLeftToBeLoaded <= 0){
					self.initMeshesAdded();
				}
			});
		}
	},

	initMeshesAdded: function(){
		// Attach bone groups to their correct parent bones.

		// TODO: You should be able to do this even before loading the meshes. 
		// But it seems that even if the bone is not at position 0, 0, 0 the mesh 
		// still DOES get added at 0, 0, 0 and it doesn't match.

		self = this;

		var head = self.character.boneGroups.get("head");
		var neck = self.character.boneGroups.get("neck");
		var torso = self.character.boneGroups.get("torso");
		var leftArm = self.character.boneGroups.get("left arm");
		var rightArm = self.character.boneGroups.get("right arm");
		var handheld = self.character.boneGroups.get("handheld");

		neck.attachToBone("torso", "#neck", torso.attachPoints["#neck"]);
		leftArm.attachToBone("torso", "#left arm", torso.attachPoints["#left arm"]);
		rightArm.attachToBone("torso", "#right arm", torso.attachPoints["#right arm"]);
		head.attachToBone("neck", "#top", neck.attachPoints["#top"]);
		handheld.attachToBone("left arm", "#hand", leftArm.attachPoints["#hand"]);

		// Place manually because OrbitControls jumps if not centered on (0, 0, 0).
		torso.skeleton.bones[0].position.y = 0;

		// Load initial pose.
		dataSource = this.libraries.get('default');
		dataSource.fetchPose(SceneModel.initialPose, function(jsonPose){
			self.character.loadPose(jsonPose);
		});
	}
};