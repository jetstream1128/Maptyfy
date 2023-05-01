'use strict';

//----------------------------------------
//APPLICATION ARCHITECTURE
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

const btnReset = document.querySelector('.reset_btn');
const btnSubmit = document.querySelector('.form__btn-submit');
const btnClose = document.querySelector('.form__btn-close');

class App {
  #map;
  #mapZoomLevel = 14;
  #mapEvent;
  #workouts = [];
  #markers = [];

  constructor() {
    //get user position
    this._getPosition();

    //get data from local storage
    this._getLocalStorage();

    //Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    document.addEventListener('keydown', this._escapeForm.bind(this));
    btnClose.addEventListener('click', this._hideForm);
    btnReset.addEventListener('click', this.reset);
    // prettier-ignore
    containerWorkouts.addEventListener('click',this._getUtilityButtonsPressed.bind(this));
    // containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));

    this._decorationEvents();
  }

  _getUtilityButtonsPressed(e) {
    if (!e) return;
    this._deleteWorkout(e);
    this._moveToPopup(e);
  }

  _refreshWorkoutsIds() {
    const idsWorkout = document.querySelectorAll('.numberId');

    this.#workouts.forEach((workout, i) => {
      workout._numberId = i + 1;
    });

    const idsWorkoutArray = Array.from(idsWorkout);
    idsWorkoutArray
      .reverse()
      .forEach((el, i) => (el.textContent = this.#workouts[i]._numberId));
  }

  _refreshMarkerIds() {
    const idsPopup = document.querySelectorAll('.leaflet-popup-content');
    if (!idsPopup) return;
    const idsPopupArray = Array.from(idsPopup);

    idsPopupArray.forEach((el, i) => {
      el.textContent = `#${i + 1} ${el.textContent.slice(2)}`;
    });
  }

  _decorationEvents(e) {
    // prettier-ignore
    btnSubmit.addEventListener('mouseover', this._changeFormShadow.bind(this, '#00914e'));
    // prettier-ignore
    btnSubmit.addEventListener('mouseleave', this._changeFormShadow.bind(this, 'none'));
    // prettier-ignore
    btnClose.addEventListener('mouseover', this._changeFormShadow.bind(this, '#bb4f46'));
    // prettier-ignore
    btnClose.addEventListener('mouseleave', this._changeFormShadow.bind(this, 'none'));
  }

  _deleteWorkout(e) {
    const btn = e.target.closest('.workout_close_btn');
    const workoutEl = e.target.closest('.workout');

    if (!btn || !workoutEl) return;
    //remove it from rendering
    workoutEl.classList.add('swipe-and-gone');
    setTimeout(() => {
      workoutEl.remove();
      //get index of current element
      let index;

      this.#workouts.find((workout, i) => {
        if (workout._id === workoutEl.dataset.id) index = i;
      });

      //delete it from workouts array
      this.#workouts.splice(index, 1);

      //delete it form markers
      this.#markers[index].remove();
      this.#markers.splice(index, 1);

      //delete from the memory
      localStorage.removeItem('workouts');
      this._setLocalStorage();
      if (this.#workouts.length === 0) localStorage.removeItem('workouts');

      //refresh marker ids on the map and list
      setTimeout(() => {
        this._refreshWorkoutsIds();
        this._refreshMarkerIds();
      }, 200);
    }, 200);
  }

  _changeFormShadow(color) {
    form.style.boxShadow = color === 'none' ? color : `0px 2px ${color}`;
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('could not get your position');
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer(
      // 'https://{s}.google.com/vt/lyrs=m&hl=x-local&src=app&x={x}&y={y}&z={z}&s=Galile',
      'http://{s}.google.com/vt/lyrs=p&hl=en&x={x}&y={y}&z={z} ',
      {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution:
          '&copy; <a href="https://www.google.com/intl/ALL/policies/terms/#toc-content">Google</a>',
      }
    ).addTo(this.#map);

    //Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';
    // form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 200);
  }

  _escapeForm(e) {
    if (e.key === 'Escape') this._hideForm();
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    e.preventDefault();

    //check if input is a number
    const validInputs = (...inp) => inp.every(inp => Number.isFinite(inp));

    //Check if input is a positive
    const allPositive = (...inp) => inp.every(inp => inp > 0);

    // get data from the form
    const type = inputType.value;
    const distance = Number(inputDistance.value);
    const duration = Number(inputDuration.value);
    const { lat, lng } = this.#mapEvent.latlng;

    let workout;

    // if workout is set to running, create running object
    if (type === 'running') {
      const cadence = Number(inputCadence.value);
      //check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('Inputs have to be positive numbers');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    //if workout is set to cycling, create a cycling object
    if (type === 'cycling') {
      const elevation = Number(inputElevation.value);
      //check if data is valid
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration, elevation)
      )
        return alert('Inputs have to be positive numbers');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    //add new object to workout array
    this.#workouts.push(workout);
    this._refreshWorkoutsIds();

    // render workout on a map as marker
    this._renderWorkoutMarker(workout);

    // render workout on list
    this._renderWorkout(workout);

    //hide form
    this._hideForm();

    //store data
    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout) {
    const myIcon = L.icon({
      iconUrl: `marker_${workout.type}.png`,
      iconSize: [44, 65],
      iconAnchor: [25, 80],
      popupAnchor: [-3, -76],
    });

    const layer = L.marker(workout.coords, { icon: myIcon })
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWith: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `#${workout._numberId} ${workout.type === 'running' ? '🏃‍♂️' : '🚴🏻'} ${
          workout.description
        }`
      )
      .openPopup();

    //push marker inside the marker array
    this.#markers.push(layer);
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout" data-id="${workout._id}">
    <div class="workout-wrapper">
      <div class="numberId workout--${workout.type}">${workout._numberId}</div>
        <div class="workout-content">
          <h2 class="workout__title">${workout.description}</h2>
          <div class="workout_close_btn"></div>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'running' ? '🏃‍♂️' : '🚴🏻'
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>
          `;
    if (workout.type === 'running')
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
            `;
    if (workout.type === 'cycling')
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed}</span>
            <span class="workout__unit">km/h</span>
          </div>
            <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
            </div>
            </div>
          </div>
        </li>`;

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work._id === workoutEl.dataset.id
    );
    if (!workout) return;

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // workout.click();
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
    // localStorage.setItem('markers', JSON.stringify(this.#markers));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;
    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
    this._refreshWorkoutsIds();
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();

class Workout {
  date = new Date();
  _numberId = 0;
  _id = String(
    Date.now() +
      Math.floor(Math.random() * 100) +
      Math.floor(Math.random() * 100)
  ).slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; //[lat, lon]
    this.distance = distance; // in Km
    this.duration = duration; // in Minutes
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    //min/km
    this.pace = (this.duration / this.distance).toFixed(1);
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    //km/h
    this.speed = (this.distance / this.duration / 60).toFixed(1);
    return this.speed;
  }
}

// const running1 = new Running([39, -12], 5.2, 24, 178);
// const cycling1 = new Cycling([39, -12], 27, 95, 523);
// console.log(running1, cycling1);
