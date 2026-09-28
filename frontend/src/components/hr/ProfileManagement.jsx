import React, { useState } from 'react';

const ProfileManagement = ({ 
  userDetails, 
  handleUpdateProfile, 
  handlePasswordChange,
  uploadProfileImage 
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [passwordChangeMode, setPasswordChangeMode] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: userDetails?.name || '',
    email: userDetails?.email || '',
    phone: userDetails?.phone || '',
    address: userDetails?.address || '',
    emergency_contact: userDetails?.emergency_contact || '',
    bio: userDetails?.bio || ''
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [selectedImage, setSelectedImage] = useState(null);
  
  const handleProfileInputChange = (e) => {
    setProfileForm({
      ...profileForm,
      [e.target.name]: e.target.value
    });
  };
  
  const handlePasswordInputChange = (e) => {
    setPasswordForm({
      ...passwordForm,
      [e.target.name]: e.target.value
    });
  };
  
  const handleProfileSubmit = (e) => {
    e.preventDefault();
    handleUpdateProfile(profileForm);
    setIsEditMode(false);
  };
  
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      alert('New passwords do not match!');
      return;
    }
    
    handlePasswordChange({
      current_password: passwordForm.current_password,
      new_password: passwordForm.new_password
    });
    
    setPasswordForm({
      current_password: '',
      new_password: '',
      confirm_password: ''
    });
    
    setPasswordChangeMode(false);
  };
  
  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
    }
  };
  
  const handleImageUpload = () => {
    if (selectedImage) {
      uploadProfileImage(selectedImage);
      setSelectedImage(null);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Profile</h2>
          <p className="text-gray-600 mt-1">View and update your personal information</p>
        </div>
        <div>
          {!isEditMode && !passwordChangeMode && (
            <button
              onClick={() => setIsEditMode(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
            >
              <i className="fas fa-user-edit mr-2"></i> Edit Profile
            </button>
          )}
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Profile Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-32 relative">
          <div className="absolute bottom-0 left-0 transform translate-y-1/2 ml-8">
            <div className="relative">
              <div className="h-24 w-24 rounded-full border-4 border-white bg-white overflow-hidden">
                {userDetails?.profile_image ? (
                  <img src={userDetails.profile_image} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-gray-300 flex items-center justify-center">
                    <i className="fas fa-user text-gray-500 text-2xl"></i>
                  </div>
                )}
              </div>
              
              {/* Image Upload Overlay */}
              <div 
                className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-40 rounded-full flex items-center justify-center cursor-pointer transition-all"
                onClick={() => document.getElementById('profile-image-input').click()}
              >
                <i className="fas fa-camera text-white opacity-0 hover:opacity-100"></i>
                <input 
                  type="file"
                  id="profile-image-input"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageChange}
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Image Upload Preview/Button */}
        {selectedImage && (
          <div className="mt-16 pt-2 px-8 flex items-center">
            <div className="flex-1">
              <span className="text-sm text-gray-600">Selected: {selectedImage.name}</span>
            </div>
            <button
              onClick={handleImageUpload}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              Upload
            </button>
            <button
              onClick={() => setSelectedImage(null)}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 ml-2"
            >
              Cancel
            </button>
          </div>
        )}
        
        {/* Profile Content */}
        <div className={`px-8 py-6 ${selectedImage ? 'pt-3' : 'pt-16'}`}>
          {/* Profile View Mode */}
          {!isEditMode && !passwordChangeMode && (
            <div className="space-y-6">
              {/* Personal Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-500">Full Name</p>
                    <p className="text-base text-gray-900">{userDetails?.name || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email Address</p>
                    <p className="text-base text-gray-900">{userDetails?.email || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Phone Number</p>
                    <p className="text-base text-gray-900">{userDetails?.phone || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Employee ID</p>
                    <p className="text-base text-gray-900">{userDetails?.employee_id || 'Not assigned'}</p>
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Work Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-gray-500">Department</p>
                    <p className="text-base text-gray-900">{userDetails?.department || 'Not assigned'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Role</p>
                    <p className="text-base text-gray-900">{userDetails?.role || 'Not assigned'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Joining Date</p>
                    <p className="text-base text-gray-900">
                      {userDetails?.joining_date ? 
                        new Date(userDetails.joining_date).toLocaleDateString() : 
                        'Not recorded'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Reporting Manager</p>
                    <p className="text-base text-gray-900">{userDetails?.manager_name || 'Not assigned'}</p>
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-500">Address</p>
                    <p className="text-base text-gray-900">{userDetails?.address || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Emergency Contact</p>
                    <p className="text-base text-gray-900">{userDetails?.emergency_contact || 'Not set'}</p>
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Information</h3>
                <div>
                  <p className="text-sm text-gray-500">Bio</p>
                  <p className="text-base text-gray-900">{userDetails?.bio || 'No information provided'}</p>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Security</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base text-gray-900">Password</p>
                    <p className="text-sm text-gray-500">Last changed {userDetails?.password_last_changed || 'unknown'}</p>
                  </div>
                  <button
                    onClick={() => setPasswordChangeMode(true)}
                    className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Change Password
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Profile Edit Form */}
          {isEditMode && (
            <form onSubmit={handleProfileSubmit} className="space-y-6">
              {/* Personal Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={profileForm.name}
                      onChange={handleProfileInputChange}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={profileForm.email}
                      onChange={handleProfileInputChange}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <input
                      type="text"
                      name="phone"
                      value={profileForm.phone}
                      onChange={handleProfileInputChange}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <textarea
                      name="address"
                      value={profileForm.address}
                      onChange={handleProfileInputChange}
                      rows="3"
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    ></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
                    <input
                      type="text"
                      name="emergency_contact"
                      value={profileForm.emergency_contact}
                      onChange={handleProfileInputChange}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Information</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                  <textarea
                    name="bio"
                    value={profileForm.bio}
                    onChange={handleProfileInputChange}
                    rows="4"
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Tell us about yourself..."
                  ></textarea>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditMode(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          )}
          
          {/* Password Change Form */}
          {passwordChangeMode && (
            <form onSubmit={handlePasswordSubmit} className="space-y-6 max-w-lg mx-auto">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Change Password</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <input
                  type="password"
                  name="current_password"
                  value={passwordForm.current_password}
                  onChange={handlePasswordInputChange}
                  required
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  name="new_password"
                  value={passwordForm.new_password}
                  onChange={handlePasswordInputChange}
                  required
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  name="confirm_password"
                  value={passwordForm.confirm_password}
                  onChange={handlePasswordInputChange}
                  required
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setPasswordChangeMode(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Change Password
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileManagement;
