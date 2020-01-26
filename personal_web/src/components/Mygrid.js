import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Grid from '@material-ui/core/Grid';
import Introduction from './Introduction'
import Projects from './Projects'
import Employment from './Employment'
import Verticaltabs from './Verticaltabs'
import Timeline from './Timeline'

const useStyles = makeStyles(theme => ({
  root: {
    flexGrow: 1,
  },
  paper: {
    padding: theme.spacing(2),
    textAlign: 'center',
    color: theme.palette.text.secondary,
  },
}));

export default function CenteredGrid() {
  const classes = useStyles();

  return (
    <div className={classes.root}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <h1 className={classes.paper}>Home</h1>
          <h1 className={classes.paper}>Image of myself (maybe carousel)</h1>
        </Grid>
        <Grid item xs={12}>
          <Introduction />
        </Grid>
        <Grid item xs={12}>
          <Projects />
        </Grid>
        <Grid item xs={12}>
          <h1> Employment Option 1 </h1>
          <Employment />
        </Grid>
        <Grid item xs={12}>
          <Verticaltabs />
        </Grid>
        <Grid item xs={12}>
          <Timeline />
        </Grid>
        <Grid item xs={6}>
           <h1 className={classes.paper}>wow</h1>
        </Grid>
        <Grid item xs={6}>
          <h1 className={classes.paper}>wow</h1>
        </Grid>
        <Grid item xs={3}>
           <h1 className={classes.paper}>wow</h1>
        </Grid>
        <Grid item xs={6}>
           <h1 className={classes.paper}>wow</h1>
        </Grid>
        <Grid item xs={1}>
           <h1 className={classes.paper}>wow</h1>
        </Grid>
        <Grid item xs={2}>
           <h1 className={classes.paper}>wow</h1>
        </Grid>
      </Grid>
    </div>
  );
}