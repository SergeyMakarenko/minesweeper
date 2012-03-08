
function Board(width, height, bombsCnt, bombsOpen) {
	this.width = width;
	this.height = height;
	this.bombsTotal = bombsCnt;
	this.bombsOpen = bombsOpen;
}

var pointingAtX = 0;
var pointingAtY = 0;


io.setPath("/");
var socket = new io.Socket('88.198.28.27', {
	resource : "data"
});

var game = null;

socket.on('connect', function() {
	socket.send(JSON.stringify([{cmd : "get_board_info"}, {cmd: "get_cells"}]));
});

socket.on('message', function(data) {
	var packet = JSON.parse(data);
	
	_(packet).each(function(msg) {
		switch (msg.cmd){
		case "start_new_game":
//			alert("New game started.");
			game = null;
			socket.send(JSON.stringify([{cmd : "get_board_info"}, {cmd: "get_cells"}]));
			break;
		case "set_board_info": {
			if (game == null) {
				game = new Object();
				game.board = new Board(msg.width, msg.height, msg.bombsTotal, msg.bombsOpen);
				createBoard(game.board);
			} else {
				game.board.bombsOpen = msg.bombsOpen;
			}
			break;
		}
		case "set_cells": {				
			_(msg.cells).each(function(cell){
				var src = blankCell.src;
				if (cell.isOpened) {
					if (cell.isBombBlown) {
						src = bombBlown.src;
					} else if (cell.isBobm) {
						src = bombRevealed.src;
					} else if (cell.neighborBombs > 0 && cell.neighborBombs < 9){
						src = cellOpenIm[cell.neighborBombs].src;
					} else if (cell.neighborBombs == 0) {
						src = cellOpenIm0[cell.color].src;							
					} else if (cell.isFlagged) {
						src = bombFlagged.src;							
					} else if (cell.isQuestion) {
						src = bombQuestion.src;
					} else if (cell.isMisflagged) {
						src = bombMisFlagged.src; 
					}
				}
				$('#cell_im_' + cell.row + '_' + cell.col).attr("src", src);					
			});
			break;
		}
		}
	});
});


$(document).ready(function() {
	preload_images();

	socket.connect();
	$(document).bind("contextmenu", function(e) {
		return false;
	});
});


function cellClick(x, y, e) {

	var request = new Object();
	if ((e != null) && (e.button != 2)) {
		request = {cmd: "left_click", row: y, col: x};
	} else {
		request = {cmd: "right_click", row: y, col: x};
	}
	
	socket.send(JSON.stringify([request]));

}

function preload_images() {
	// preload moves counter images
	movesDigits0 = new Image(23, 13);
	movesDigits0.src = "images/moves0.png";

	// preload images: 9 open tiles (0..8)
	cellOpenIm = new Array(9);
	for (l = 1; l < 9; l++) {
		cellOpenIm[l] = new Image(16, 16);
		tstr = "images/open" + l + ".png";
		cellOpenIm[l].src = tstr;
	}
	var colors = ["neutral", "red", "green", "blue"];
	cellOpenIm0 = [];
	_(colors).each(function (color) {
		cellOpenIm0[color] = new Image(16, 16);
		cellOpenIm0[color].src = "images/open0_" + color + ".png";
	});
	
	// preload images: the many faces of bombs and bomb markers
	bombFlagged = new Image(16, 16);
	bombFlagged.src = "images/bombflagged.png";
	bombRevealed = new Image(16, 16);
	bombRevealed.src = "images/bombrevealed.png";
	bombMisFlagged = new Image(16, 16);
	bombMisFlagged.src = "images/bombmisflagged.png";
	bombBlown = new Image(16, 16);
	bombBlown.src = "images/bombblown.png";
	bombQuestion = new Image(16, 16);
	bombQuestion.src = "images/bombquestion.png";
	blankCell = new Image(16, 16);
	blankCell.src = "images/blank.png";
}


// Saves the current pointing location of the mouse. Called w/ onMouseOver
// for each cell.
function cursorHoldLoc(x, y) {
	pointingAtX = x;
	pointingAtY = y;
}

// Clears the saved location. Needed when user points outside the grid.
// Note: I check that I'm clearing the correct cell, just in case events
// occur out of order.
function cursorClearLoc(x, y) {
	if ((pointingAtX == x) && (pointingAtY == y)) {
		pointingAtX = -1;
		pointingAtY = -1;
	}
}

// Special routine to ignore dragging starts.
// Allows the mouse to be in motion when the user clicks.
// Only works in IE because there is no onDrag handler in Mozilla
function ignoreDragging() {
	try {
		window.event.returnValue = false;
	} catch (e) {
	}
	return false;
}



function createBoard(board) {
	var smileMargin = ((board.width) * 16 - (13 * 6 + 26)) / 2;// To center smile & rt

	var html_str = '';
	// By putting the grid into a table cell, nowrap can be used. Good for
	// Opera.
	html_str += '<a onclick="socket.send(JSON.stringify([{cmd: \'show_misflagged\'}]));">Show misflagged</a><br>';
	html_str += '<a onclick="socket.send(JSON.stringify([{cmd: \'start_new_game\'}]));">Start new game</a>';
	html_str += '<div>';

	// Build the top line
	html_str += '<img src="images/bordertl.png" alt="" />';
	for (j = 0; j < board.width; j++) {
		html_str += '<img src="images/bordertb.png" height="10" width="16" alt="" />';
	}
	html_str += '<img src="images/bordertr.png" alt="" /><br />';


	// Build the main grid itself, placing it on-screen. Note the l/r edge
	// Also, using a temp string to build line before display. Speeds up
	// display.
	for (i = 0; i < board.height; i++) {
		html_str += '<img src="images/borderlr.png" height="16" width="10" alt="" />';
		for (j = 0; j < board.width; j++) {
			// IE requires onDragStart, Netscape requires onDrag. Click is
			// handled via onmouseup.
			html_str += '<a id = cell_' + i + '_' + j + ' ' +
					'onClick="" ' +
//					'ondragstart="ignoreDragging()" ' + 
//					'ondrag="ignoreDragging()" ' +
					'onmouseover="cursorHoldLoc(' + j + ',' + i+ ')" ' +
					'onmouseout="cursorClearLoc(' + j + ',' + i + ')" ' +
					'onmouseup="cellClick('+ j + ',' + i + ', event)">';
			html_str += '<img src="images/blank.png" id = "cell_im_' + i + '_'
					+ j + '" border="0" alt="" /></a>';
		}
		html_str += '<img src="images/borderlr.png" border="0" height="16" width="10" alt="" /><br />';
	}

	// Build the bottom line, including corners
	html_str += '<img src="images/borderbl.png" alt="" />';
	for (j = 0; j < board.width; j++) {
		html_str += '<img src="images/bordertb.png" height="10" width="16" alt="" />';
	}
	html_str += '<img src="images/borderbr.png" alt="" /><br />';

	$("#divBoard").html(html_str);
}
