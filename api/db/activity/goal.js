module.exports = {
  apdActivityGoal: {
    tableName: 'activity_goals',

    activity() {
      return this.belongsTo('apdActivity');
    },

    toJSON() {
      return {
        id: this.get('id'),
        description: this.get('description'),
        objective: this.get('objective')
      };
    },

    static: {
      updateableFields: ['description', 'objective'],
      foreignKey: 'activity_goal_id'
    }
  }
};
