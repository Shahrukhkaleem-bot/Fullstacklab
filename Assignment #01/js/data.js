// ConnecFriend seed data.
// There is no server in this assignment, so these members, posts, invites and messages
// are copied into localStorage the first time the site opens (see store.js).
// All demo passwords follow the pattern: <username>123  (e.g. shahrukh / shahrukh123)

const SEED_VERSION = 2;
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function buildSeed(now = Date.now()) {
  const user = (username, name, color, details, lastLoginAgo, friends, extra = {}) => ({
    username,
    password: username + '123',
    name,
    color,
    photo: null,
    bio: details.bio,
    city: details.city,
    university: details.university,
    dob: details.dob,
    gender: details.gender,
    email: `${username}@connecfriend.pk`,
    phone: details.phone,
    joined: now - details.joinedDaysAgo * DAY,
    lastLogin: now - lastLoginAgo,
    friends,
    ignored: extra.ignored || [],
    ratings: extra.ratings || {}
  });

  const users = [
    user('shahrukh', 'Shahrukh Kaleem', '#4f46e5',
      { bio: 'BSCS 5th semester, Air University', city: 'Islamabad', university: 'Air University', dob: '2005-03-14', gender: 'Male', phone: '0312-3456789', joinedDaysAgo: 420 },
      3 * DAY, ['ali', 'sara', 'hamza', 'ayesha', 'bilal', 'zainab'],
      { ratings: { ali: 3, sara: 2, hamza: 2, ayesha: 3, bilal: 1, zainab: 3 } }),
    user('ali', 'Ali Raza', '#0891b2',
      { bio: 'cricket and chai', city: 'Rawalpindi', university: 'NUST', dob: '2004-11-02', gender: 'Male', phone: '0300-1112233', joinedDaysAgo: 380 },
      4 * MIN, ['shahrukh', 'sara', 'usman'], { ratings: { shahrukh: 3 } }),
    user('sara', 'Sara Ahmed', '#db2777',
      { bio: 'Designer @ FAST', city: 'Lahore', university: 'FAST NUCES', dob: '2005-07-21', gender: 'Female', phone: '0321-4455667', joinedDaysAgo: 300 },
      25 * MIN, ['shahrukh', 'ali', 'zainab']),
    user('hamza', 'Hamza Tariq', '#16a34a',
      { bio: 'CP | gaming', city: 'Islamabad', university: 'Air University', dob: '2004-09-09', gender: 'Male', phone: '0333-9988776', joinedDaysAgo: 410 },
      2 * HOUR, ['shahrukh', 'bilal']),
    user('ayesha', 'Ayesha Siddiqui', '#ea580c',
      { bio: 'IBA, batch 2027', city: 'Karachi', university: 'IBA Karachi', dob: '2005-01-30', gender: 'Female', phone: '0345-1234567', joinedDaysAgo: 250 },
      5 * HOUR, ['shahrukh', 'zainab', 'noor']),
    user('bilal', 'Bilal Naveed', '#7c3aed',
      { bio: 'football > everything', city: 'Peshawar', university: 'UET Peshawar', dob: '2004-05-17', gender: 'Male', phone: '0311-2223344', joinedDaysAgo: 200 },
      1 * DAY + 3 * HOUR, ['shahrukh', 'hamza']),
    user('zainab', 'Zainab Fatima', '#0d9488',
      { bio: 'reading most of the time', city: 'Islamabad', university: 'Air University', dob: '2005-12-05', gender: 'Female', phone: '0336-7778899', joinedDaysAgo: 330 },
      45 * MIN, ['shahrukh', 'sara', 'ayesha']),
    user('usman', 'Usman Khalid', '#b45309',
      { bio: 'learning security stuff', city: 'Multan', university: 'BZU', dob: '2004-08-12', gender: 'Male', phone: '0301-5556677', joinedDaysAgo: 150 },
      6 * HOUR, ['ali']),
    user('noor', 'Noor Rehman', '#be123c',
      { bio: 'KEMU', city: 'Lahore', university: 'King Edward Medical University', dob: '2005-02-25', gender: 'Female', phone: '0322-3332211', joinedDaysAgo: 120 },
      2 * DAY, ['ayesha']),
    user('fahad', 'Fahad Javed', '#475569',
      { bio: 'running a small online store', city: 'Faisalabad', university: 'GCU Faisalabad', dob: '2003-10-10', gender: 'Male', phone: '0302-9090909', joinedDaysAgo: 90 },
      30 * MIN, [], { ignored: ['shahrukh'] }), // Fahad has ignored Shahrukh, so Shahrukh cannot invite him
    user('hira', 'Hira Naeem', '#c026d3',
      { bio: 'SE student at COMSATS', city: 'Islamabad', university: 'COMSATS', dob: '2005-06-18', gender: 'Female', phone: '0331-4545454', joinedDaysAgo: 60 },
      15 * MIN, []),
    user('moiz', 'Moiz Baig', '#0369a1',
      { bio: 'Abbottabad', city: 'Abbottabad', university: 'COMSATS Abbottabad', dob: '2004-04-04', gender: 'Male', phone: '0344-1212121', joinedDaysAgo: 45 },
      3 * HOUR, [])
  ];

  const post = (id, author, text, ago, likes, dislikes, audience = 'all', sharedWith = []) =>
    ({ id, author, text, at: now - ago, likes, dislikes, audience, sharedWith, sharedFrom: null });

  const posts = [
    post('p1', 'ali', 'what a match yaar, last over mein 14 chahiye thay and we did it', 10 * MIN, ['sara', 'usman', 'shahrukh'], []),
    post('p2', 'zainab', 'finished The Alchemist again. still the best', 50 * MIN, ['sara', 'ayesha'], ['ali']),
    post('p3', 'sara', 'finally submitted my HCI project. 3 nights without sleep', 2 * HOUR, ['zainab', 'ali', 'shahrukh'], []),
    post('p4', 'hamza', '500 problems done on codeforces', 3 * HOUR, ['bilal'], []),
    post('p5', 'ayesha', 'anyone has good notes for PyTorch? need them for my ML course', 6 * HOUR, ['zainab'], [], 'some', ['shahrukh', 'zainab']),
    post('p6', 'bilal', 'we are in the final!! match on saturday 4pm, come if you can', 1 * DAY + 4 * HOUR, ['hamza'], ['shahrukh']),
    post('p7', 'shahrukh', 'FSWD assignment due this week. pray for me', 3 * DAY, ['ali', 'zainab', 'hamza'], []),
    post('p8', 'usman', 'won the uni CTF today', 7 * HOUR, ['ali'], []),
    post('p9', 'noor', '12 hour shift done. going to sleep now', 2 * DAY, ['ayesha'], [])
  ];

  const invites = [
    { id: 'i1', from: 'hira', to: 'shahrukh', status: 'pending', at: now - 20 * MIN },
    { id: 'i2', from: 'moiz', to: 'shahrukh', status: 'pending', at: now - 4 * HOUR }
  ];

  const message = (id, from, to, text, ago, read = true) => ({ id, from, to, text, at: now - ago, read });
  const messages = [
    message('m1', 'ali', 'shahrukh', 'match dekha kal?', 2 * HOUR),
    message('m2', 'shahrukh', 'ali', 'haan yaar, last over was crazy', 1 * HOUR + 50 * MIN),
    message('m3', 'ali', 'shahrukh', 'sunday ko F-9 ground chalein?', 12 * MIN, false),
    message('m4', 'sara', 'shahrukh', 'can you check my portfolio site when you are free?', 1 * DAY),
    message('m5', 'shahrukh', 'sara', 'sure send the link', 23 * HOUR),
    message('m6', 'usman', 'shahrukh', 'hi, Ali gave me your name. you do web dev right? can I ask something', 3 * HOUR, false)
  ];

  return { version: SEED_VERSION, users, posts, invites, messages };
}
