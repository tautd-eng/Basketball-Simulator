// Made-up player names for generated draft classes: a first and a last name from broad pools
// (American, African, European, Latin and other names, as in today's league), never the same full name twice.
import { hash01 } from '../rng';

const FIRST = `Aaron Abdul Adrian Ahmad Alec Alonzo Amari Andre Andrei Anthony Antoine Ari Armando Aston Austin Bakari Ben Bennett Blake
Bo Bobby Brandon Brendan Bryce Caleb Calvin Cam Carlos Carter Cedric Chance Chris Clint Cole Collin Cooper Corey Curtis Dalton Damon
Dante Darius Darnell Davion Dejan Deandre Demetrius Denzel Derrick Desmond Devin Dion Dmitri Dominic Donovan Dorian Drew Duane Dwayne
Eddie Eli Elijah Emeka Emil Emmanuel Enzo Eric Ethan Evan Felix Filip Francisco Gabe Garrett Gavin Gerald Giannis Grady Grant Hakeem
Hassan Hector Henry Ian Ibrahim Isaac Isaiah Ivan Jabari Jace Jaden Jalen Jamal Jameson Jared Jarrett Javier Jaylen Jerome Jett Joaquin
Jonah Jordan Jovan Julian Justin Kai Kareem Keenan Keith Kelvin Kendall Kenji Keon Khalil Kobe Kofi Kyle Lamar Lance Landon Lars Lazar
Leon Levi Liam Luca Lucas Luka Malik Marcus Mario Markus Marlon Mason Mateo Max Micah Miles Milan Moses Nate Nemanja Niko Noah Obi
Omar Oscar Owen Pablo Pascal Patrick Quentin Quincy Rafael Rashad Ray Reggie Rodney Roman Ronan Rudy Ryan Sam Samir Santiago Saul
Sekou Sergio Seth Shane Simon Stefan Terrell Theo Tobias Tre Trent Tristan Troy Tyrese Tyson Uros Victor Vince Wade Wesley Xavier
Yannick Yusuf Zach Zaire Zion`.split(/\s+/);
const LAST = `Abbott Adebayo Alexander Allen Alvarez Anderson Anthony Archer Armstrong Atkins Bailey Baker Banks Barnes Barrett Bates Beasley
Bell Bennett Bishop Black Blake Bogdan Boone Bowen Boyd Bradley Brooks Bryant Burke Burns Caldwell Campbell Carr Carter Castillo Chambers
Chandler Clark Coleman Collins Cooper Cortez Crawford Cross Cruz Cunningham Daniels Davidson Dawson Diallo Diaz Dixon Douglas Doumbia Drake
Duncan Edwards Ellis Evans Farrell Fernandez Fields Fisher Fleming Flowers Ford Foster Fox Francis Freeman Garcia Gardner Gibson Gilbert
Gomez Gordon Graham Grant Graves Gray Greene Griffin Hale Hall Hamilton Hardy Harper Harris Hart Hayes Henderson Herrera Hicks Hill Hodge
Holland Holmes Horton Howard Hudson Hughes Hunter Ingram Irving Ivanov Jackson Jacobs James Jenkins Johnson Jokic Jones Jordan Kamara
Keller Kelly Kennedy King Knight Kovac Lambert Lane Lawrence Lewis Lindqvist Little Lloyd Long Lopez Lowe Lucas Lyons Mack Maddox Marsh
Martin Mason Matthews Maxwell Mbeki McCoy McDaniel Medina Miller Mills Mitchell Monroe Moore Morgan Morris Murphy Murray Ndiaye Nelson
Newman Nichols Nkemelu Novak Obi Okafor Oliver Ortiz Osei Owens Palmer Parker Patel Patterson Payne Pearson Perry Peters Petrovic Phillips
Pierce Porter Powell Price Quinn Ramirez Ramos Reed Reese Reeves Reid Reyes Rhodes Rice Richards Rivera Roberts Robinson Rodriguez Rogers
Rose Ross Russell Ruiz Sanders Santos Savic Scott Shaw Silva Simmons Sims Smith Snyder Sow Spencer Stanley Stewart Stone Sullivan Sutton
Taylor Terry Thomas Thompson Torres Traore Tucker Turner Vasquez Vaughn Wade Walker Wallace Walsh Ward Warren Washington Watkins Watson
Webb Wells West White Wiggins Williams Willis Wilson Wood Wright Young Zubac`.split(/\s+/);

/** A made-up name for a generated prospect (the same id always gets the same name; `taken` keeps them unique). */
export function fakeName(id: string, taken: Set<string>): string {
  for (let k = 0; k < 50; k++) {
    const f = FIRST[Math.floor(hash01(id + 'fn' + k) * FIRST.length)], l = LAST[Math.floor(hash01(id + 'ln' + k) * LAST.length)];
    const n = `${f} ${l}`;
    if (!taken.has(n)) { taken.add(n); return n; }
  }
  const n = `${FIRST[0]} ${LAST[0]} ${taken.size}`; taken.add(n); return n;
}
