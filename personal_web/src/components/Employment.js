import React, { Component } from 'react'
import Grid from '@material-ui/core/Grid';
import CardMedia from '@material-ui/core/CardMedia';
import GridList from '@material-ui/core/GridList';
import GridListTile from '@material-ui/core/GridListTile';
import Paper from '@material-ui/core/Paper';
import AppBar from '@material-ui/core/AppBar'
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import IconButton from '@material-ui/core/IconButton';
import MenuIcon from '@material-ui/icons/Menu';
import { makeStyles } from '@material-ui/core/styles';


import machine_learning from '../images/machine-learning.jpg'
import rap_genius from '../images/red-vinyl-record.jpg'
import basketball from '../images/basketball.jpg'

const useStyles = makeStyles(theme => ({
  root: {
    flexGrow: 1,
  },
  menuButton: {
    marginRight: theme.spacing(2),
  },
  title: {
    flexGrow: 1,
  },
}));


class Employment extends Component {

  constructor(props) {
	super(props);
	// Don't call this.setState() here!
	this.state = { counter: 0 };
	this.handleClick = this.handleClick.bind(this);
  }

  handleClick() {}
  
  render() {

    return (
      <div>
        <h1>Work Experience</h1>
        <Grid container spacing={3}>
        	<Grid item xs={12}>
        		<h1>Canoga Perkins</h1>
        		<Paper>xs=12 sm=6</Paper>
          	</Grid>
          	<Grid item xs={12}>
          		<h1>Innovatus</h1>
          		<Paper>xs=12 sm=6</Paper>
        	</Grid>
        	<Grid item xs={12}>
        	    <AppBar position="static">
		          <Toolbar>
		            <IconButton edge="start" className='menuButton' color="inherit" aria-label="menu">
		              <MenuIcon />
		            </IconButton>
		            <Typography variant="h6" className='title'>
		              Canoga Perkins
		            </Typography>
		          </Toolbar>
		        </AppBar>
          		<Paper>xs=12 sm=6</Paper>
        	</Grid>
        	<Grid item xs={12}>
        	    <AppBar position="static">
		          <Toolbar>
		            <IconButton edge="start" className='menuButton' color="inherit" aria-label="menu">
		              <MenuIcon />
		            </IconButton>
		            <Typography variant="h6" className='title'>
		              Innovatus
		            </Typography>
		          </Toolbar>
		        </AppBar>
          		<Paper>xs=12 sm=6</Paper>
        	</Grid>
        </Grid>
      </div>
    )
  }
}

export default Employment