var http = require('http'); 
var io = require('socket.io');
var express = require('express');
var sys = require('sys');
var _ = require('underscore')._;

//process.on('uncaughtException', function (err) {
//	  console.log('Caught exception: ' + err);
//	});


function clone_properties(obj, props, true_props) {
	var result = {};
	if (true_props) {
		props = props.concat(_(true_props).select(function(prop) {
			if (typeof(obj[prop]) == "number") {
				return true;
			}
			return obj[prop] === true;				
		}));
	}
	_(props).each(function(prop) {
		if (prop != "" && obj.hasOwnProperty(prop)) {
			result[prop] = obj[prop];
		}			
	});

	return result;
}

function Cell(row, col) {
	this.row = row;
	this.col = col;
	this.isBomb = false;
	this.isBombBlown = false;
	this.isOpened = false;
	this.isFlagged = false;
	this.isQuestion = false;
	this.neighborBombs = null;
	this.isMisflagged = false;
	this.color = "neutral";
}

function Board(width, height, bombsCnt) {
	this.width = width;
	this.height = height;
	this.bombsTotal = bombsCnt;
	this.bombsOpen = 0;
	this.cells = [];
	
	for (var i = 0; i < this.height; i++) {
		this.cells[i] = [];
		for (var j = 0; j < this.width; j++) {
			this.cells[i][j] = new Cell(i, j);
		}
	}
	
	var bombsPlaced = 0;
	while (bombsPlaced < this.bombsTotal) {
		var row = Math.floor(Math.random() * (this.height));
		var col = Math.floor(Math.random() * (this.width));
		var cell = this.cells[row][col];
		if (!cell.isBomb) {
			cell.isBomb = true;
			bombsPlaced++;
		}
	}	
}

Board.prototype.check_bounds = function (row, col) {
	return row >= 0 && row < this.height && col >= 0 && col < this.width;
};

Board.prototype.get_cell = function (row, col) {
	return  this.check_bounds(row, col)? this.cells[row][col]: null;
};

Board.prototype.find_neighbor_bombs = function (cell, realBombs) {
	var result = [];
	var board = this;
	_([-1, 0, 1]).each(function (row_shift){
		_([-1, 0, 1]).each(function (col_shift){
			if (row_shift !== 0 || col_shift !== 0) {
				var cur_cell = board.get_cell(cell.row + row_shift, cell.col + col_shift);
				if (cur_cell !== null) {
					if (realBombs) {
						if (cur_cell.isBomb) {
							result.push(clone_properties(cur_cell, ["row", "col", "isOpened", "isBomb"]));
						}
					} else {
						if (cur_cell.isFlagged || cur_cell.isBombBlown) {
							result.push(clone_properties(cur_cell, ["row", "col", "isOpened"], ["isFlagged", "isBombBlown"]));
						}
					}
				}
			}
		});
	});
	return result;
};


Board.prototype.find_misflagged_bombs = function (cell) {
	var result = [];
	var board = this;

	_([-1, 0, 1]).each(function(row_shift){
		_([-1, 0, 1]).each(function(col_shift){
			if (row_shift !== 0 || col_shift !== 0) {
				var cur_cell = board.get_cell(cell.row + row_shift, cell.col + col_shift);
				if (cur_cell !== null && cur_cell.isMisflagged && cur_cell.isFlagged) {
					cur_cell.isFlagged = false;
					result.push(clone_properties(cur_cell, ["row", "col", "isOpened", "isMisflagged"]));
				}
			}					
		});
	});			
	
	return result;
};


Board.prototype.open_cell = function (cellToOpen, firstCell, client) {
	if (cellToOpen === null) {
		return [];
	}
	
	var result = [];	
	var realBombs = [];
	var markedBombs = [];
	var cur_cells = [cellToOpen];
	var board = this;

	var processCell = function (cell) {
		if (cell.isBomb && !cell.isOpened && firstCell) {
			  cell.isOpened = true;
			  cell.isBombBlown = true;
			  result.push(clone_properties(cell, ["row", "col", "isOpened", "isBombBlown"]));
		} else if (!cell.isOpened) { //click on closed cell
			realBombs = board.find_neighbor_bombs(cell, true);
			cell.isOpened = true;
			cell.neighborBombs = realBombs.length;
			cell.color = client.color;
			result.push(clone_properties(cell, ["row", "col", "isOpened", "neighborBombs", "color"]));
			if (realBombs.length === 0) {
				_([-1, 0, 1]).each(function(row_shift){
					_([-1, 0, 1]).each(function(col_shift){
						if (row_shift !== 0 || col_shift !== 0) {
							var cellToOpen = board.get_cell(cell.row + row_shift, cell.col + col_shift);
							if (cellToOpen !== null) {
								next_cells.push(cellToOpen);
							}
						}					
					});
				});
			}
		} else if (cell.isOpened && firstCell) {
			realBombs = board.find_neighbor_bombs(cell, true);
			markedBombs = board.find_neighbor_bombs(cell, false);
			if (cell.neighborBombs === markedBombs.length) {
				var misflaggedBombs = board.find_misflagged_bombs(cell);
				if (misflaggedBombs.length > 0) {
					result = result.concat(misflaggedBombs);
					_(realBombs).each(function (bomb) {
						var blownBomb = board.get_cell(bomb.row, bomb.col); 
						blownBomb.isOpened = true;
						blownBomb.isBombBlown = true;
						result.push(clone_properties(blownBomb, ["row", "col", "isOpened", "isBombBlown"]));
					});
				}else {
					_([-1, 0, 1]).each(function(row_shift){
						_([-1, 0, 1]).each(function(col_shift){
							if (row_shift !== 0 || col_shift !== 0) {
								var cellToOpen = board.get_cell(cell.row + row_shift, cell.col + col_shift);
								if (cellToOpen !== null && !cellToOpen.isOpened) {
									next_cells.push(cellToOpen);
								}
							}					
						});
					});			
				}
			}
		}
	};

	while (cur_cells.length > 0) {
		var next_cells = [];
		_(cur_cells).each(processCell);
		console.log("cur_cell: " + cur_cells.length + "; next_cells: " + next_cells.length +
				"result: " + result.length);
		cur_cells = next_cells;
		next_cells = [];
		firstCell = false;
	}

	return result;
};


function createNewBoard() {
	return new Board(50, 50, 350, 0);
}

var serverRoom = {
		clients : {},
		board : createNewBoard()
};

var app = express.createServer(express.staticProvider(__dirname + '/public'));
app.listen(80);

var socket = io.listen(app, {resource: "data"});

var playerColors = ["red", "green", "blue"];
var freeColors = playerColors.slice(0);

socket.on('connection', function(client){

	serverRoom.clients[client.sessionId] = client;
	client.room = serverRoom;
	client.points = 0;
	if (freeColors.length === 0) {
		freeColors = playerColors.slice(0);
	}
	if (freeColors.length > 0) {
		client.color = freeColors.pop();
	} else {
		client.color = "neutral";
	}
	
	client.on('message', function(data){
	  try {
		  var reply = [];
		  var command = {};
		  var cell = null;
		  var board = client.room.board;
		  

		  _(JSON.parse(data)).each(function (msg) {
			  console.log("request: " + sys.inspect(msg, true));


			  switch(msg.cmd) {

			  case "start_new_game":
				  serverRoom.board = createNewBoard();
				  reply.push({cmd: "start_new_game"});
				  break;
				  
			  case "show_misflagged":
				  command.cmd = "set_cells";
				  command.cells = [];
				  _(board.cells).each(function(row) {
					  _(row).each(function(cell) {
						  if (cell.isMisflagged) {
							  command.cells.push(clone_properties(cell,
									  ["row", "col", "isOpened", "isMisflagged"]));
						  }
					  });
				  });
				  if (command.cells.length > 0) {
					  reply.push(command);
				  }
				  break;

			  case "get_board_info":
				  reply.push({
					  cmd: "set_board_info",
					  bombsTotal: board.bombsTotal,
					  bombsOpen: board.bombsOpen,
					  width: board.width,
					  height: board.height});
				  reply.push({cmd: "set_score", color: client.color, points: client.points});
				  
				  break;
				  

			  case "get_cells": 
				  command.cmd = "set_cells";
				  command.cells = [];
				  _(board.cells).each(function(row) {
					  _(row).each(function (cell) {
						  if (cell.isOpened) {
							  command.cells.push(clone_properties(cell,
									  ["row", "col", "isOpened", "color"],
									  ["isQuestion", "isFlagged", "isBombBlown", "neighborBombs"]));
						  }				  
					  });
				  });
				  if (command.cells.length > 0) {
					  reply.push(command);
				  }
				  break;

			  case "left_click": 
				  if (!board.check_bounds(msg.row, msg.col)) {
					  return;
				  }
				  
				  cell = board.cells[msg.row][msg.col];
				  if (cell.isFlagged) {
					  return;
				  } else if (cell.isBomb && cell.isOpened){
					  return;
				  } else {
					  var openedCells = board.open_cell(cell, true, client);
					  if (openedCells.length > 0) {
						  _(openedCells).each(function (cell) {
							  if (cell.isOpened) {
								  if (cell.isBombBlown) {
									  client.points -= 10;
								  } else if (cell.neighborBombs >= 0) {
									  client.points += 1;
								  } 								  
							  }
						  });
						  reply.push({cmd: "set_cells", cells: openedCells});
						  reply.push({cmd: "set_score", color: client.color, points: client.points});
					  }
				  }
				  
				  break;

			  case "right_click": 
				  if (!board.check_bounds(msg.row, msg.col)) {
					  return;
				  }
				  cell = board.cells[msg.row][msg.col];
				  
				  if (cell.isMisflagged && !cell.isFlagged) {
					  
				  } else if (cell.isBombBlown) {
					  return;
				  } else if (cell.isFlagged) {
					  cell.isFlagged = false;
					  cell.isQuestion = true;
					  cell.isMisflagged = false;
					  reply.push({cmd: "set_cells", cells: [clone_properties(cell,
							  ["row", "col", "isOpened", "isQuestion"])]});
				  } else if (cell.isQuestion) {
					  cell.isQuestion = false;
					  cell.isOpened = false;
					  reply.push({cmd: "set_cells", cells: [clone_properties(cell, ["row", "col", "isOpened"])]});
				  } else if (cell.neighborBombs === null) {
					  cell.isOpened = true;
					  cell.isFlagged = true;
					  if (!cell.isBomb) {
						  cell.isMisflagged = true;
					  }
					  reply.push({cmd: "set_cells", cells: [clone_properties(cell,
							  ["row", "col", "isOpened", "isFlagged"])]});
				  }
				  break;
			  }		  
		  });
		  
		  console.log("reply: " + sys.inspect(reply, true, 10));
		  if (reply.length > 0 ) {
			  _(serverRoom.clients).each(function (peer) {
				  peer.send(JSON.stringify(reply));
			  });
//			  client.send(JSON.stringify(reply));		  
		  }
	  } catch(e) {
		  console.log("Exception caught: " + sys.inspect(e));
	  }	  
  });

  client.on('disconnect', function(){
		delete serverRoom.clients[client.sessionId];

  });
});

