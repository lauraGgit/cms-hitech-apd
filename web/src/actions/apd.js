import { push } from 'react-router-redux';

import { notify } from './notification';
import axios from '../util/api';
import { toAPI } from '../util/serialization/apd';

const LAST_APD_ID_STORAGE_KEY = 'last-apd-id';

export const ADD_APD_KEY_PERSON = 'ADD_APD_KEY_PERSON';
export const ADD_APD_POC = 'ADD_APD_POC';
export const CREATE_APD = 'CREATE_APD';
export const CREATE_APD_REQUEST = 'CREATE_APD_REQUEST';
export const CREATE_APD_SUCCESS = 'CREATE_APD_SUCCESS';
export const CREATE_APD_FAILURE = 'CREATE_APD_FAILURE';
export const GET_APD_REQUEST = 'GET_APD_REQUEST';
export const GET_APD_SUCCESS = 'GET_APD_SUCCESS';
export const GET_APD_FAILURE = 'GET_APD_FAILURE';
export const REMOVE_APD_KEY_PERSON = 'REMOVE_APD_KEY_PERSON';
export const REMOVE_APD_POC = 'REMOVE_APD_POC';
export const SAVE_APD_REQUEST = 'SAVE_APD_REQUEST';
export const SAVE_APD_SUCCESS = 'SAVE_APD_SUCCESS';
export const SAVE_APD_FAILURE = 'SAVE_APD_FAILURE';
export const SELECT_APD = 'SELECT_APD';
export const SUBMIT_APD_REQUEST = 'SUBMIT_APD_REQUEST';
export const SUBMIT_APD_SUCCESS = 'SUBMIT_APD_SUCCESS';
export const SUBMIT_APD_FAILURE = 'SUBMIT_APD_FAILURE';
export const UPDATE_APD = 'UPDATE_APD';
export const UPDATE_BUDGET = 'UPDATE_BUDGET';

export const SET_SELECT_APD_ON_LOAD = 'SET_SELECT_APD_ON_LOAD';
export const selectApdOnLoad = () => ({ type: SET_SELECT_APD_ON_LOAD });

export const addPointOfContact = () => ({ type: ADD_APD_POC });
export const removePointOfContact = index => ({ type: REMOVE_APD_POC, index });

export const updateBudget = () => (dispatch, getState) =>
  dispatch({ type: UPDATE_BUDGET, state: getState() });

export const requestApd = () => ({ type: GET_APD_REQUEST });
export const receiveApd = data => ({ type: GET_APD_SUCCESS, data });
export const failApd = error => ({ type: GET_APD_FAILURE, error });

export const addApdKeyPerson = () => ({ type: ADD_APD_KEY_PERSON });
export const removeApdKeyPerson = id => ({ type: REMOVE_APD_KEY_PERSON, id });

export const updateApd = updates => dispatch => {
  dispatch({ type: UPDATE_APD, updates });
  if (updates.years) {
    dispatch(updateBudget());
  }
};

export const selectApd = (id, { global = {}, pushRoute = push } = {}) => (
  dispatch,
  getState
) => {
  dispatch({ type: SELECT_APD, apd: getState().apd.byId[id] });
  dispatch(updateBudget());
  dispatch(pushRoute('/apd'));

  if (global.localStorage) {
    global.localStorage.setItem(LAST_APD_ID_STORAGE_KEY, id);
  }
};

export const createRequest = () => ({ type: CREATE_APD_REQUEST });
export const createSuccess = data => ({ type: CREATE_APD_SUCCESS, data });
export const createFailure = () => ({ type: CREATE_APD_FAILURE });
export const createApd = ({ pushRoute = push } = {}) => dispatch => {
  dispatch(createRequest());
  return axios
    .post('/apds')
    .then(req => {
      dispatch(createSuccess(req.data));
      dispatch(selectApd(req.data.id, { pushRoute }));
    })
    .catch(error => {
      const reason = error.response ? error.response.data : 'N/A';
      dispatch(createFailure(reason));
    });
};

export const requestSave = () => ({ type: SAVE_APD_REQUEST });
export const saveSuccess = data => ({ type: SAVE_APD_SUCCESS, data });
export const saveFailure = () => ({ type: SAVE_APD_FAILURE });

export const fetchApd = ({ global = window, pushRoute = push } = {}) => (
  dispatch,
  getState
) => {
  dispatch(requestApd());

  const url = `/apds`;

  return axios
    .get(url)
    .then(req => {
      const apd = Array.isArray(req.data) ? req.data : null;
      dispatch(receiveApd(apd));

      const { apd: { selectAPDOnLoad } } = getState();
      if (
        selectAPDOnLoad &&
        global.localStorage &&
        global.localStorage.getItem(LAST_APD_ID_STORAGE_KEY)
      ) {
        dispatch(
          selectApd(global.localStorage.getItem('last-apd-id'), {
            global,
            pushRoute
          })
        );
      }
    })
    .catch(error => {
      const reason = error.response ? error.response.data : 'N/A';
      dispatch(failApd(reason));
    });
};

const shouldFetchApd = state => !state.apd.loaded;

export const fetchApdDataIfNeeded = () => (dispatch, getState) => {
  if (shouldFetchApd(getState())) {
    return dispatch(fetchApd());
  }

  return null;
};

export const notifyNetError = (action, error) => {
  const { response: res } = error;
  const reason = (res && (res.data || {}).error) || 'not-sure-why';

  return notify(`${action} failed (${reason})`);
};

export const saveApd = ({ serialize = toAPI } = {}) => (dispatch, state) => {
  dispatch(requestSave());

  const { apd: { data: updatedApd }, activities, dirty } = state();

  if (!dirty.dirty) {
    dispatch(notify('Save successful!'));
    return Promise.resolve();
  }

  const apd = serialize(updatedApd, activities);

  // These are the fields we want to remove if they aren't dirty.
  const filterAPDFields = [
    'federalCitations',
    'incentivePayments',
    'narrativeHIE',
    'narrativeHIT',
    'narrativeMMIS',
    'programOverview',
    'previousActivityExpenses',
    'previousActivitySummary',
    'stateProfile'
  ];
  const filterActivityFields = [
    'contractorResources',
    'costAllocation',
    'costAllocationNarrative',
    'expenses',
    'goals',
    'schedule',
    'standardsAndConditions',
    'statePersonnel',
    'quarterlyFFP'
  ];

  filterAPDFields.forEach(field => {
    if (!dirty.data.apd[field]) {
      delete apd[field];
    }
  });

  for (let i = apd.activities.length - 1; i >= 0; i -= 1) {
    const activity = apd.activities[i];
    if (!dirty.data.activities.byKey[activity.key]) {
      // If this activity isn't dirty, strip it from the list to save,
      // but then add just its ID back - this prevents it from being
      // deleted by the API synchronization.
      apd.activities.splice(i, 1);
      apd.activities.push({ id: activity.id });
    } else {
      const dirtyActivity = dirty.data.activities.byKey[activity.key];
      // Get rid of any activity fields that aren't dirty.
      filterActivityFields.forEach(field => {
        if (!dirtyActivity[field]) {
          delete activity[field];
        }
      });
    }
  }

  return axios
    .put(`/apds/${updatedApd.id}`, apd)
    .then(res => {
      dispatch(notify('Save successful!'));
      dispatch(saveSuccess(res.data));
    })
    .catch(error => {
      dispatch(notifyNetError('Save', error));
      dispatch(saveFailure());
      throw error;
    });
};

export const submitAPD = (save = saveApd) => (dispatch, getState) =>
  dispatch(save())
    .then(() => {
      dispatch({ type: SUBMIT_APD_REQUEST });

      const {
        activities: { byKey: activities },
        apd: { data: { id: apdID } },
        budget
      } = getState();

      const tables = {
        activityQuarterlyFederalShare: Object.entries(budget.activities).reduce(
          (acc, [key, activity]) => ({
            ...acc,
            [activities[key].name]: activity.quarterlyFFP
          }),
          {}
        ),
        summaryBudgetTable: {
          hie: budget.hie,
          hit: budget.hit,
          mmis: budget.mmis,
          total: budget.combined
        },
        federalShareByFFYQuarter: budget.federalShareByFFYQuarter,
        programBudgetTable: {
          hitAndHie: {
            hit: budget.hit.combined,
            hie: budget.hie.combined,
            hitAndHie: budget.hitAndHie.combined
          },
          mmis: budget.mmisByFFP
        }
      };

      return axios
        .post(`/apds/${apdID}/versions`, { tables })
        .then(() => {
          dispatch(notify('Submission successful!'));
          dispatch({ type: SUBMIT_APD_SUCCESS });
        })
        .catch(error => {
          dispatch(notifyNetError('Submit', error));
          dispatch({ type: SUBMIT_APD_FAILURE });
        });
    })
    .catch(error => {
      dispatch(notifyNetError('Submit', error));
    });
