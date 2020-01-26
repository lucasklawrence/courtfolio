import React, { Component } from 'react'
import Grid from '@material-ui/core/Grid';
import CardMedia from '@material-ui/core/CardMedia';
import GridList from '@material-ui/core/GridList';
import GridListTile from '@material-ui/core/GridListTile';

import machine_learning from '../images/machine-learning.jpg'
import rap_genius from '../images/red-vinyl-record.jpg'
import basketball from '../images/basketball.jpg'

export default class Projects extends Component {
  render() {

  	const tileData = [
	  	{
	  		img: machine_learning,
	  		title: "test", 
	  		author: "me"
	  	},
	  	{
	  		img: rap_genius,
	  		title: "test", 
	  		author: "me"
	  	},
	  	{
	  		img: basketball,
	  		title: "test", 
	  		author: "me"
	  	},
	  	{
	  		img: machine_learning,
	  		title: "test", 
	  		author: "me"
	  	},
	  	{
	  		img: rap_genius,
	  		title: "test", 
	  		author: "me"
	  	},
	  	{
	  		img: basketball,
	  		title: "test", 
	  		author: "me"
	  	}
  	]

    return (
      <div>
        <h1>Projects</h1>
        <GridList cellHeight={160} cols={3}>
	        {tileData.map(tile => (
	          <GridListTile key={tile.img} cols={tile.cols || 1}>
	            <img src={tile.img} alt={tile.title} />
	          </GridListTile>
	        ))}
	    </GridList>
        <Grid container spacing={3}>
        	<Grid item xs={4}>
        		<p> test </p>
          	</Grid>
          	<Grid item xs={4}>
          		<p>Image2</p>
        	</Grid>
        	<Grid item xs={4}>
          		<p>Image3</p>
        	</Grid>
        </Grid>
      </div>
    )
  }
}