class UserService {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }
  async getAllUsers() {
    try {
      const result = await this.userRepository.getAllUsers();
      return result.users;
    } catch (error) {
      throw new Error(`Error fetching users: ${error.message}`);
    }
  }
  async getUserById(userId) {
    try {
      const user = await this.userRepository.getUserById(userId);
      return user;
    } catch (error) {
      throw new Error(
        `Error fetching user with ID ${userId}: ${error.message}`
      );
    }
  }
}
module.exports = UserService;
// This code defines a UserService class that provides methods to interact with user data
