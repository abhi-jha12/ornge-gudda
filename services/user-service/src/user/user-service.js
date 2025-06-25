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
  async getUserByClientId(clientId) {
    try {
      const user = await this.userRepository.getUserByClientId(clientId);
      return user;
    } catch (error) {
      throw new Error(
        `Error fetching user with client ID ${clientId}: ${error.message}`
      );
    }
  }
  async getUserSubscription(clientId) {
    try {
      const subscription = await this.userRepository.getUserSubscription(
        clientId
      );
      return subscription;
    } catch (error) {
      throw new Error(
        `Error fetching subscription for client ID ${clientId}: ${error.message}`
      );
    }
  }
  async updateUserByClientId(clientId, userData) {
    try {
      const updatedUser = await this.userRepository.updateUserByClientId(
        clientId,
        userData
      );
      return updatedUser;
    } catch (error) {
      throw new Error(
        `Error updating user with client ID ${clientId}: ${error.message}`
      );
    }
  }
  async updateUserSubscription(clientId, subscriptionData) {
    try {
      const updatedSubscription =
        await this.userRepository.updateUserSubscription(
          clientId,
          subscriptionData
        );
      return updatedSubscription;
    } catch (error) {
      throw new Error(
        `Error updating subscription for client ID ${clientId}: ${error.message}`
      );
    }
  }
  async createUserSubscription(clientId, subscriptionData) {
    try {
      const newSubscription =
        await this.userRepository.createUserSubscription(
          clientId,
          subscriptionData
        );
      return newSubscription;
    } catch (error) {
      throw new Error(
        `Error creating subscription for client ID ${clientId}: ${error.message}`
      );
    }
  }
}
module.exports = UserService;
// This code defines a UserService class that provides methods to interact with user data
